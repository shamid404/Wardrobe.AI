import base64
import ipaddress
import socket
from typing import List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import WishlistItem
from ..models.schemas import WishlistItemCreate, WishlistItemOut
from ..services.minio_service import upload_file

_BLOCKED_NETS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))
        return not any(ip in net for net in _BLOCKED_NETS)
    except Exception:
        return False


def _decode_base64(b64_string: str) -> tuple[bytes, str]:
    if b64_string.startswith("data:"):
        header, data = b64_string.split(",", 1)
        content_type = header.split(";")[0].replace("data:", "") or "image/jpeg"
        return base64.b64decode(data), content_type
    try:
        return base64.b64decode(b64_string), "image/jpeg"
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

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


@router.patch("/wishlist/{item_id}", response_model=WishlistItemOut)
def update_wishlist_item(item_id: str, body: WishlistItemCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(WishlistItem).filter(WishlistItem.id == item_id, WishlistItem.user_id == user["id"]).first()
    if not item:
        raise HTTPException(status_code=404, detail="Wishlist item not found")
    for field in ("source", "product_url", "tag_photo_url", "description", "notes"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(item, field, val)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


class ImageUploadBody(BaseModel):
    image_base64: str | None = None
    image_url: str | None = None


async def _resolve_base64(body: ImageUploadBody) -> str:
    if body.image_base64:
        return body.image_base64
    if body.image_url:
        if body.image_url.startswith("data:") or not body.image_url.startswith("http"):
            return body.image_url
        if not _is_safe_url(body.image_url):
            raise HTTPException(status_code=400, detail="Invalid or disallowed image URL")
        import httpx
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(body.image_url)
        r.raise_for_status()
        return base64.b64encode(r.content).decode()
    raise HTTPException(status_code=400, detail="No image provided")


@router.post("/upload-image")
async def upload_wishlist_image(body: ImageUploadBody, user=Depends(get_current_user)):
    import asyncio
    img_bytes, content_type = _decode_base64(await _resolve_base64(body))
    url = await asyncio.to_thread(upload_file, img_bytes, content_type, "wishlist")
    return {"url": url}


@router.post("/analyze-clothing")
async def analyze_wishlist_clothing(body: ImageUploadBody, user=Depends(get_current_user)):
    import asyncio
    from ..services.vision_service import analyze_wishlist_item
    raw = await _resolve_base64(body)
    result = await asyncio.to_thread(analyze_wishlist_item, raw)
    return result
