import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import Outfit, OutfitItem, WardrobeItem
from ..models.schemas import OutfitCreate, OutfitOut, OutfitItemOut

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
