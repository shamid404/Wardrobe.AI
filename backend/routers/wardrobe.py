import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..auth import get_current_user
from ..db.memory_store import WARDROBE_DB
from ..models.schemas import ClothingItem, ClothingItemOut

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


@router.get("", response_model=List[ClothingItemOut])
def get_wardrobe(user=Depends(get_current_user)):
    """Return all clothing items for the current user."""
    return WARDROBE_DB.get(user["id"], [])


@router.post("", response_model=ClothingItemOut, status_code=status.HTTP_201_CREATED)
def add_clothing(item: ClothingItem, user=Depends(get_current_user)):
    """Add a new clothing item (metadata only)."""
    new_item = {
        "id": f"item_{uuid.uuid4().hex[:8]}",
        "uploaded_at": datetime.utcnow().date().isoformat(),
        **item.model_dump(),
    }
    WARDROBE_DB.setdefault(user["id"], []).append(new_item)
    return new_item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing(item_id: str, user=Depends(get_current_user)):
    """Remove a clothing item from the wardrobe."""
    items = WARDROBE_DB.get(user["id"], [])
    updated = [i for i in items if i["id"] != item_id]
    if len(updated) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    WARDROBE_DB[user["id"]] = updated


@router.post("/{item_id}/image")
async def upload_clothing_image(
    item_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload a clothing photo. In production: store to S3-compatible storage."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    contents = await file.read()
    size_kb = len(contents) / 1024

    # TODO: upload contents to MinIO / S3
    return {
        "item_id": item_id,
        "filename": file.filename,
        "size_kb": round(size_kb, 1),
        "storage_url": f"https://storage.wardrobe.ai/{user['id']}/{item_id}.jpg",
        "status": "uploaded",
    }
