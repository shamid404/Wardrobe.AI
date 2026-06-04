"""Week outfit planner — AI-built outfits for the next 7 days.

Generates one outfit per day from the user's available wardrobe, matched to the
7-day weather forecast, and persists them so the calendar reloads instantly.
"""
import json
from datetime import date, datetime, timedelta
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import WardrobeItem, OutfitPlan
from ..services.gemini import call_gemini_json

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["planner"])

WEEK = 7


# ─────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────
class PlanWeekRequest(BaseModel):
    start: Optional[str] = None          # YYYY-MM-DD; defaults to today
    lat: Optional[float] = None
    lon: Optional[float] = None
    prompt: Optional[str] = None         # optional vibe, e.g. "smart casual week"


class PlanDayRequest(BaseModel):
    date: str                            # YYYY-MM-DD
    lat: Optional[float] = None
    lon: Optional[float] = None
    prompt: Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def _wmo(c: int) -> str:
    if c == 0: return "clear"
    if c in (1, 2, 3): return "partly cloudy"
    if c in (45, 48): return "fog"
    if c in (51, 53, 55): return "drizzle"
    if c in (61, 63, 65): return "rain"
    if c in (71, 73, 75): return "snow"
    if c in (80, 81, 82): return "rain showers"
    if c in (95, 96, 99): return "thunderstorm"
    return "cloudy"


def _forecast_by_date(lat: Optional[float], lon: Optional[float]) -> dict:
    """Returns { 'YYYY-MM-DD': {'tmin', 'tmax', 'desc'} } for the next ~7 days."""
    if lat is None or lon is None:
        return {}
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,weathercode",
                "timezone": "auto",
                "forecast_days": WEEK,
            },
            timeout=10,
        )
        r.raise_for_status()
        daily = r.json()["daily"]
        out = {}
        for i, d in enumerate(daily["time"]):
            out[d] = {
                "tmin": round(daily["temperature_2m_min"][i]),
                "tmax": round(daily["temperature_2m_max"][i]),
                "desc": _wmo(daily["weathercode"][i]),
            }
        return out
    except Exception:
        return {}


def _weather_str(w: Optional[dict]) -> Optional[str]:
    if not w:
        return None
    return f"{w['tmin']}–{w['tmax']}°C, {w['desc']}"


def _plan_dates(start: Optional[str]) -> List[str]:
    try:
        base = datetime.strptime(start, "%Y-%m-%d").date() if start else date.today()
    except ValueError:
        base = date.today()
    return [(base + timedelta(days=i)).isoformat() for i in range(WEEK)]


def _available_items(db: Session, user_id: str) -> List[WardrobeItem]:
    return (
        db.query(WardrobeItem)
        .filter(WardrobeItem.user_id == user_id, WardrobeItem.status != "laundry")
        .all()
    )


def _wardrobe_text(items: List[WardrobeItem]) -> str:
    lines = []
    for it in items:
        parts = [f"{it.name} ({it.category})"]
        if it.color:
            parts.append(it.color)
        if it.season:
            parts.append(it.season)
        lines.append("  - " + ", ".join(parts))
    return "\n".join(lines) if lines else "  (wardrobe is empty)"


def _serialize_plan(d: str, plan: Optional[OutfitPlan], item_map: dict, weather: Optional[dict]) -> dict:
    items = []
    if plan:
        try:
            ids = json.loads(plan.item_ids)
        except Exception:
            ids = []
        for iid in ids:
            it = item_map.get(iid)
            if it:
                items.append({
                    "item_id": it.id,
                    "name": it.name,
                    "category": it.category,
                    "image_url": it.image_url,
                })
    return {
        "date": d,
        "occasion": plan.occasion if plan else None,
        "note": plan.note if plan else None,
        "weather": _weather_str(weather) if weather else (plan.weather if plan else None),
        "items": items,
    }


def _upsert_plan(db: Session, user_id: str, d: str, item_ids: List[str], occasion: Optional[str], note: Optional[str], weather: Optional[str]):
    plan = db.query(OutfitPlan).filter(OutfitPlan.user_id == user_id, OutfitPlan.date == d).first()
    if plan:
        plan.item_ids = json.dumps(item_ids)
        plan.occasion = occasion
        plan.note = note
        plan.weather = weather
    else:
        plan = OutfitPlan(user_id=user_id, date=d, item_ids=json.dumps(item_ids), occasion=occasion, note=note, weather=weather)
        db.add(plan)
    return plan


def _gemini_plan(items: List[WardrobeItem], day_specs: List[dict], user_prompt: Optional[str], avoid_recent: Optional[List[str]] = None) -> dict:
    """Ask Gemini to plan the given days. Returns parsed dict {"days":[...]} or {}."""
    days_lines = []
    for spec in day_specs:
        w = spec.get("weather")
        wtxt = f"weather {_weather_str(w)}" if w else "weather unknown"
        days_lines.append(f"  {spec['date']} ({spec['weekday']}): {wtxt}")
    days_text = "\n".join(days_lines)

    avoid_text = ""
    if avoid_recent:
        avoid_text = f"\nAvoid reusing these recently-worn items if possible: {', '.join(avoid_recent)}."

    extra = f"\nUser preference for the week: {user_prompt}" if user_prompt else ""

    prompt = f"""You are a personal stylist planning daily outfits for a wardrobe app.

<wardrobe>
{_wardrobe_text(items)}
</wardrobe>

Plan an outfit for each of these days:
{days_text}{extra}{avoid_text}

Rules:
- One outfit per day. Each outfit should include a top (or a dress), a bottom (skip if it's a dress), and shoes when available. Add outerwear when it is cold (max temp below 15°C) or rainy. Headwear/accessories are optional.
- Match warmth and weather: warmer layers on cold days, water-friendly choices on rainy days.
- Do NOT use the exact same item on two consecutive days. Vary outfits across the week.
- Only use items that exist in the wardrobe above. Use the EXACT item names.
- Give each day a short occasion label (e.g. "Casual", "Office", "Rainy day", "Cozy") and a one-line note (max 8 words).
- If the wardrobe is too small, reuse sensibly but still vary.

Respond with ONLY this JSON (no markdown):
{{
  "days": [
    {{ "date": "YYYY-MM-DD", "occasion": "Casual", "note": "short note", "item_names": ["Exact Name 1", "Exact Name 2"] }}
  ]
}}"""

    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    # Scale the output budget with the number of days so a 7-day plan isn't
    # truncated mid-JSON (which caused {"error":"generation_failed"}).
    max_tokens = min(8192, 1200 + 1000 * len(day_specs))
    parsed, _raw = call_gemini_json(contents, max_tokens=max_tokens, temperature=0.8)
    if isinstance(parsed, list):
        return {"days": parsed}          # model returned a bare array
    if isinstance(parsed, dict):
        return parsed
    return {}


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────
@router.get("/plans")
def get_plans(
    request: Request,
    start: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dates = _plan_dates(start)
    forecast = _forecast_by_date(lat, lon)
    plans = (
        db.query(OutfitPlan)
        .filter(OutfitPlan.user_id == user["id"], OutfitPlan.date.in_(dates))
        .all()
    )
    by_date = {p.date: p for p in plans}
    all_items = db.query(WardrobeItem).filter(WardrobeItem.user_id == user["id"]).all()
    item_map = {i.id: i for i in all_items}
    return [_serialize_plan(d, by_date.get(d), item_map, forecast.get(d)) for d in dates]


@router.post("/assistant/plan-week")
@limiter.limit("10/minute")
def plan_week(
    request: Request,
    req: PlanWeekRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dates = _plan_dates(req.start)
    forecast = _forecast_by_date(req.lat, req.lon)
    items = _available_items(db, user["id"])
    item_map = {i.id: i for i in items}
    name_to_item = {i.name.lower(): i for i in items}

    if not items:
        return {"error": "empty_wardrobe", "days": []}

    day_specs = [
        {"date": d, "weekday": datetime.strptime(d, "%Y-%m-%d").strftime("%A"), "weather": forecast.get(d)}
        for d in dates
    ]

    parsed = _gemini_plan(items, day_specs, req.prompt)
    days = parsed.get("days", []) if isinstance(parsed, dict) else []
    if not days:
        return {"error": "generation_failed", "days": []}

    result = []
    for idx, spec in enumerate(day_specs):
        d = spec["date"]
        day = next((x for x in days if x.get("date") == d), None)
        if not day and idx < len(days):
            day = days[idx]  # positional fallback if the model didn't echo dates
        if not day:
            result.append(_serialize_plan(d, None, item_map, spec["weather"]))
            continue
        names = day.get("item_names", []) or []
        ids = [name_to_item[n.lower()].id for n in names if n.lower() in name_to_item]
        plan = _upsert_plan(
            db, user["id"], d, ids,
            day.get("occasion"), day.get("note"),
            _weather_str(spec["weather"]),
        )
        result.append(_serialize_plan(d, plan, item_map, spec["weather"]))

    db.commit()
    return {"days": result}


@router.post("/assistant/plan-day")
@limiter.limit("20/minute")
def plan_day(
    request: Request,
    req: PlanDayRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = _available_items(db, user["id"])
    item_map = {i.id: i for i in items}
    name_to_item = {i.name.lower(): i for i in items}
    if not items:
        return {"error": "empty_wardrobe"}

    forecast = _forecast_by_date(req.lat, req.lon)
    weather = forecast.get(req.date)

    # Avoid items used on the adjacent days for variety.
    try:
        base = datetime.strptime(req.date, "%Y-%m-%d").date()
        neighbours = [(base + timedelta(days=o)).isoformat() for o in (-1, 1)]
    except ValueError:
        neighbours = []
    avoid = []
    if neighbours:
        for p in db.query(OutfitPlan).filter(OutfitPlan.user_id == user["id"], OutfitPlan.date.in_(neighbours)).all():
            try:
                for iid in json.loads(p.item_ids):
                    it = item_map.get(iid)
                    if it:
                        avoid.append(it.name)
            except Exception:
                pass

    spec = [{"date": req.date, "weekday": datetime.strptime(req.date, "%Y-%m-%d").strftime("%A"), "weather": weather}]
    parsed = _gemini_plan(items, spec, req.prompt, avoid_recent=avoid or None)
    days = parsed.get("days", []) if isinstance(parsed, dict) else []
    if not days:
        return {"error": "generation_failed"}

    day = days[0]
    names = day.get("item_names", []) or []
    ids = [name_to_item[n.lower()].id for n in names if n.lower() in name_to_item]
    plan = _upsert_plan(db, user["id"], req.date, ids, day.get("occasion"), day.get("note"), _weather_str(weather))
    db.commit()
    return _serialize_plan(req.date, plan, item_map, weather)


@router.delete("/plans/{plan_date}", status_code=204)
def delete_plan(
    plan_date: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(OutfitPlan).filter(OutfitPlan.user_id == user["id"], OutfitPlan.date == plan_date).delete()
    db.commit()
    return None
