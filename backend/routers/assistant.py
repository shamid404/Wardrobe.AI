import json
import requests
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from ..auth import get_current_user
from ..config import GEMINI_API_KEY
from ..db.database import get_db
from ..db.models import WardrobeItem, Outfit, ChatSession, ChatMessage as ChatMessageModel

router = APIRouter(tags=["assistant"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    lat: Optional[float] = None
    lon: Optional[float] = None
    session_id: Optional[str] = None


def _fetch_forecast(lat: float, lon: float) -> str:
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum",
                "current": "temperature_2m,weathercode",
                "timezone": "auto",
                "forecast_days": 7,
            },
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        def wmo(c: int) -> str:
            if c == 0: return "clear sky"
            if c in (1, 2, 3): return "partly cloudy"
            if c in (45, 48): return "foggy"
            if c in (51, 53, 55): return "drizzle"
            if c in (61, 63, 65): return "rain"
            if c in (71, 73, 75): return "snow"
            if c in (80, 81, 82): return "rain showers"
            if c in (95, 96, 99): return "thunderstorm"
            return "cloudy"

        current_temp = round(data["current"]["temperature_2m"])
        current_desc = wmo(data["current"]["weathercode"])

        daily = data["daily"]
        days = []
        for i, date in enumerate(daily["time"]):
            label = "Today" if i == 0 else ("Tomorrow" if i == 1 else date)
            t_max = round(daily["temperature_2m_max"][i])
            t_min = round(daily["temperature_2m_min"][i])
            desc = wmo(daily["weathercode"][i])
            rain = daily["precipitation_sum"][i]
            days.append(f"  {label}: {t_min}–{t_max}°C, {desc}" + (f", {rain}mm rain" if rain > 0 else ""))

        return f"Current weather: {current_temp}°C, {current_desc}\n7-day forecast:\n" + "\n".join(days)
    except Exception:
        return "Weather data unavailable."


@router.post("/assistant/chat")
@limiter.limit("20/minute")
async def assistant_chat(
    request: Request,
    req: ChatRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Build wardrobe context
    items = db.query(WardrobeItem).filter(WardrobeItem.user_id == user["id"]).all()
    wardrobe_lines = []
    for it in items:
        parts = [f"{it.name} ({it.category})"]
        if it.brand:
            parts.append(f"brand: {it.brand}")
        if it.size:
            parts.append(f"size: {it.size}")
        if it.color:
            parts.append(f"color: {it.color}")
        if it.season:
            parts.append(f"season: {it.season}")
        wardrobe_lines.append("  - " + ", ".join(parts))
    wardrobe_text = "\n".join(wardrobe_lines) if wardrobe_lines else "  (wardrobe is empty)"

    # Build saved outfits context
    outfits = db.query(Outfit).filter(Outfit.user_id == user["id"]).order_by(Outfit.created_at.desc()).all()
    outfits_lines = []
    for o in outfits:
        item_names = [oi.wardrobe_item.name for oi in o.items if oi.wardrobe_item]
        tag = " [AI suggested]" if o.ai_suggested else ""
        outfits_lines.append(f"  - \"{o.name}\"{tag}: {', '.join(item_names)}")
    outfits_text = "\n".join(outfits_lines) if outfits_lines else "  (no saved outfits yet)"

    # Build weather context
    weather_text = ""
    if req.lat is not None and req.lon is not None:
        weather_text = f"\n\nWeather context:\n{_fetch_forecast(req.lat, req.lon)}"

    system_prompt = f"""You are a personal fashion stylist assistant for a wardrobe app called Wardrobe.AI.
Your role is to help users build outfits and give style advice based ONLY on items they actually own.

<user_wardrobe>
{wardrobe_text}
</user_wardrobe>

<user_outfits>
{outfits_text}
</user_outfits>{weather_text}

IMPORTANT — Response format:
Always respond with valid JSON in this exact structure:
{{
  "message": "your friendly reply text here",
  "recommended_items": ["Exact Item Name 1", "Exact Item Name 2"]
}}

Rules:
- SCOPE: You ONLY answer questions about fashion, clothing, style, outfits, wardrobe, accessories, and weather-based dressing. If the user asks about anything else (politics, coding, math, history, relationships, etc.), politely decline and redirect them to fashion topics.
- Only recommend items from the user's wardrobe listed above. Never suggest items they don't have.
- If a saved outfit matches the user's request, mention it by name and suggest wearing it.
- You can reference saved outfits in your message text, but recommended_items must still list the individual item names.
- In recommended_items, use the EXACT item names as they appear in the wardrobe list.
- If you are not recommending specific items (e.g. answering a general question), set recommended_items to [].
- Consider the weather when giving advice if weather data is available.
- Be concise, friendly, and practical.
- Respond in the same language the user writes in (message field).
- If the wardrobe is empty, suggest they add items first and set recommended_items to [].
- Return ONLY the JSON object, no markdown, no extra text."""

    # Load session early so we can use DB history (not client-provided history)
    session_id = req.session_id
    session = None
    if session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == user["id"],
        ).first()

    db_history = []
    if session:
        db_history = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.session_id == session.id)
            .order_by(ChatMessageModel.created_at.asc())
            .all()
        )

    # Build Gemini conversation
    contents = [{"role": "user", "parts": [{"text": system_prompt + "\n\n[Conversation starts]"}]},
                {"role": "model", "parts": [{"text": "Got it! I'm ready to help you style outfits from your wardrobe."}]}]

    for msg in db_history[-10:]:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.content}]})

    contents.append({"role": "user", "parts": [{"text": req.message}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        },
    }

    models = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
    ]

    # Create session if it wasn't found above
    if not session:
        title = req.message[:60] + ("..." if len(req.message) > 60 else "")
        session = ChatSession(user_id=user["id"], title=title)
        db.add(session)
        db.flush()

    # Save user message
    db.add(ChatMessageModel(session_id=session.id, role="user", content=req.message))

    last_error = None
    for model in models:
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                timeout=30,
            )
            if r.status_code in (429, 503):
                last_error = f"{r.status_code} from {model}"
                continue
            r.raise_for_status()
            raw = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            try:
                parsed = json.loads(raw)
                reply = parsed.get("message", raw)
                recommended_names = parsed.get("recommended_items", [])
            except json.JSONDecodeError:
                reply = raw
                recommended_names = []

            # Resolve item IDs for recommended items
            all_items = db.query(WardrobeItem).filter(WardrobeItem.user_id == user["id"]).all()
            name_to_item = {i.name.lower(): i for i in all_items}
            rec_ids = [name_to_item[n.lower()].id for n in recommended_names if n.lower() in name_to_item]

            # Save assistant message
            db.add(ChatMessageModel(
                session_id=session.id,
                role="assistant",
                content=reply,
                recommended_item_ids=json.dumps(rec_ids) if rec_ids else None,
            ))
            db.commit()

            return {
                "reply": reply,
                "recommended_items": recommended_names,
                "session_id": session.id,
            }
        except Exception as e:
            last_error = str(e)
            continue

    db.rollback()
    return {"reply": "Service temporarily unavailable. Please try again in a moment.", "recommended_items": [], "session_id": session.id if session else None}
