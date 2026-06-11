import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import Outfit, OutfitItem, WardrobeItem
from ..models.schemas import OutfitCreate, OutfitOut, OutfitItemOut
from ..services.gemini import call_gemini_json
from ..services.ml_service import score_outfit as ml_score_outfit

router = APIRouter(prefix="/outfits", tags=["outfits"])


def _to_out(outfit: Outfit) -> OutfitOut:
    return OutfitOut(
        id=outfit.id,
        name=outfit.name,
        ai_suggested=outfit.ai_suggested,
        created_at=outfit.created_at.date().isoformat(),
        items=[
            OutfitItemOut(
                item_id=oi.item_id,
                name=oi.wardrobe_item.name,
                category=oi.wardrobe_item.category,
                image_url=oi.wardrobe_item.image_url,
            )
            for oi in outfit.items
            if oi.wardrobe_item is not None
        ],
    )


@router.get("", response_model=List[OutfitOut])
def get_outfits(user=Depends(get_current_user), db: Session = Depends(get_db)):
    outfits = db.query(Outfit).filter(Outfit.user_id == user["id"]).order_by(Outfit.created_at.desc()).all()
    return [_to_out(o) for o in outfits]


@router.post("", response_model=OutfitOut, status_code=status.HTTP_201_CREATED)
def create_outfit(data: OutfitCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not data.item_ids:
        raise HTTPException(status_code=400, detail="Outfit must have at least one item")

    # Verify all items belong to this user
    items = db.query(WardrobeItem).filter(
        WardrobeItem.id.in_(data.item_ids),
        WardrobeItem.user_id == user["id"],
    ).all()
    found_ids = {i.id for i in items}

    outfit = Outfit(
        id=f"outfit_{uuid.uuid4().hex[:8]}",
        user_id=user["id"],
        name=data.name,
        ai_suggested=data.ai_suggested,
    )
    db.add(outfit)
    db.flush()

    for item_id in data.item_ids:
        if item_id in found_ids:
            db.add(OutfitItem(
                id=f"oi_{uuid.uuid4().hex[:8]}",
                outfit_id=outfit.id,
                item_id=item_id,
            ))

    db.commit()
    db.refresh(outfit)
    return _to_out(outfit)


@router.post("/{outfit_id}/score")
def score_outfit(outfit_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    outfit = db.query(Outfit).filter(
        Outfit.id == outfit_id,
        Outfit.user_id == user["id"],
    ).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Return cached scores if available
    if outfit.fit_score is not None and outfit.style_score is not None and outfit.color_harmony is not None:
        return {"fit_score": outfit.fit_score, "style_score": outfit.style_score, "color_harmony": outfit.color_harmony}

    items = [oi.wardrobe_item for oi in outfit.items if oi.wardrobe_item]
    if not items:
        return {"fit_score": 70, "style_score": 70, "color_harmony": 70}

    items_desc = []
    for it in items:
        parts = [f"{it.name} ({it.category})"]
        if it.color:
            parts.append(f"color: {it.color}")
        if it.brand:
            parts.append(f"brand: {it.brand}")
        if it.season:
            parts.append(f"season: {it.season}")
        items_desc.append(", ".join(parts))

    # Primary: local CLIP + MLP model
    ml_result = ml_score_outfit(items_desc)
    ml_is_fallback = all(ml_result.get(k) == 75 for k in ("fit_score", "style_score", "color_harmony"))

    if not ml_is_fallback:
        _save_scores(outfit, ml_result, db)
        return ml_result

    # Secondary: Gemini (only when ML models aren't loaded / failed)
    prompt = f"""You are a fashion expert. Score this outfit on three metrics, each 0-100.

Outfit: "{outfit.name}"
Items:
{chr(10).join(f"  - {d}" for d in items_desc)}

Return JSON only:
{{"fit_score": <int 0-100>, "style_score": <int 0-100>, "color_harmony": <int 0-100>}}

fit_score: how well items work together functionally (occasion, season, layering)
style_score: overall aesthetic coherence and trend relevance
color_harmony: how well the colors complement each other"""

    result, _ = call_gemini_json(
        contents=[{"role": "user", "parts": [{"text": prompt}]}],
        max_tokens=64,
        temperature=0.3,
    )

    if result and all(k in result for k in ("fit_score", "style_score", "color_harmony")):
        scores = {
            "fit_score":     max(0, min(100, int(result["fit_score"]))),
            "style_score":   max(0, min(100, int(result["style_score"]))),
            "color_harmony": max(0, min(100, int(result["color_harmony"]))),
        }
        _save_scores(outfit, scores, db)
        return scores

    return ml_result  # 75/75/75 neutral fallback


def _save_scores(outfit: Outfit, scores: dict, db: Session) -> None:
    outfit.fit_score = scores["fit_score"]
    outfit.style_score = scores["style_score"]
    outfit.color_harmony = scores["color_harmony"]
    db.commit()


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit(outfit_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    outfit = db.query(Outfit).filter(
        Outfit.id == outfit_id,
        Outfit.user_id == user["id"],
    ).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    db.delete(outfit)
    db.commit()
