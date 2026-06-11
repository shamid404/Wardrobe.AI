from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import WishlistItem
from ..models.schemas import WishlistItemCreate, WishlistItemOut
from ..services.minio_service import upload_file

router = APIRouter(prefix="/shopping", tags=["shopping"])


def _item_to_out(i: WishlistItem) -> WishlistItemOut:
    return WishlistItemOut(
        id=i.id,
        preview_url=i.preview_url,
        clothing_image_url=i.clothing_image_url,
        source=i.source,
        product_url=i.product_url,
        tag_photo_url=i.tag_photo_url,
        description=i.description,
        notes=i.notes,
        created_at=i.created_at.isoformat(),
    )


@router.post("/wishlist", response_model=WishlistItemOut)
def add_to_wishlist(body: WishlistItemCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    item = WishlistItem(
        user_id=user["id"],
        preview_url=body.preview_url,
        clothing_image_url=body.clothing_image_url,
        source=body.source,
        product_url=body.product_url,
        tag_photo_url=body.tag_photo_url,
        description=body.description,
        notes=body.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


@router.get("/wishlist", response_model=List[WishlistItemOut])
def get_wishlist(user=Depends(get_current_user), db: Session = Depends(get_db)):
    items = (
        db.query(WishlistItem)
        .filter(WishlistItem.user_id == user["id"])
        .order_by(WishlistItem.created_at.desc())
        .all()
    )
    return [_item_to_out(i) for i in items]


@router.delete("/wishlist/{item_id}")
def remove_from_wishlist(item_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter(WishlistItem.id == item_id, WishlistItem.user_id == user["id"]).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    db.delete(item)
    db.commit()
    return {"deleted": True}


class ImageUploadBody(BaseModel):
    image_base64: str


@router.post("/upload-image")
def upload_wishlist_image(body: ImageUploadBody, user=Depends(get_current_user)):
    url = upload_file(body.image_base64)
    return {"url": url}
