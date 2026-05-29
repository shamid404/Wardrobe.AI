import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import WardrobeItem
from ..models.schemas import ClothingItem, ClothingItemOut, ClothingItemUpdate
from ..services.minio_service import upload_file, delete_file

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


def _to_out(item: WardrobeItem) -> ClothingItemOut:
    return ClothingItemOut(
        id=item.id,
        name=item.name,
        category=item.category,
        brand=item.brand,
        size=item.size,
        color=item.color,
        season=item.season,
        image_url=item.image_url,
        status=item.status or "available",
        uploaded_at=item.uploaded_at.date().isoformat(),
    )


@router.get("", response_model=List[ClothingItemOut])
def get_wardrobe(user=Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(WardrobeItem).filter(WardrobeItem.user_id == user["id"]).all()
    return [_to_out(i) for i in items]


@router.post("", response_model=ClothingItemOut, status_code=status.HTTP_201_CREATED)
def add_clothing(item: ClothingItem, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db_item = WardrobeItem(
        id=f"item_{uuid.uuid4().hex[:8]}",
        user_id=user["id"],
        name=item.name,
        category=item.category,
        brand=item.brand,
        size=item.size,
        color=item.color,
        season=item.season,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return _to_out(db_item)


@router.patch("/{item_id}", response_model=ClothingItemOut)
def update_clothing(
    item_id: str,
    data: ClothingItemUpdate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_id,
        WardrobeItem.user_id == user["id"],
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if data.name is not None:
        item.name = data.name
    if data.category is not None:
        item.category = data.category
    if data.brand is not None:
        item.brand = data.brand
    if data.size is not None:
        item.size = data.size
    if data.color is not None:
        item.color = data.color
    if data.season is not None:
        item.season = data.season
    if data.status is not None:
        item.status = data.status
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing(item_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_id,
        WardrobeItem.user_id == user["id"],
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.image_url:
        delete_file(item.image_url)
    db.delete(item)
    db.commit()


@router.post("/{item_id}/image", response_model=ClothingItemOut)
async def upload_clothing_image(
    item_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    item = db.query(WardrobeItem).filter(
        WardrobeItem.id == item_id,
        WardrobeItem.user_id == user["id"],
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.image_url:
        delete_file(item.image_url)

    contents = await file.read()
    url = upload_file(contents, file.content_type, folder=f"wardrobe/{user['id']}")
    item.image_url = url
    db.commit()
    db.refresh(item)
    return _to_out(item)
