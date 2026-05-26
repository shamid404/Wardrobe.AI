import base64

import requests
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import REMOVE_BG_API_KEY
from ..db.database import get_db
from ..db.models import User
from ..services.minio_service import upload_file
from ..services.vision_service import analyze_clothing, analyze_and_validate

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["avatar"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@router.post("/avatar/image")
async def upload_avatar_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload user avatar photo to MinIO and save URL to DB."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    contents = await file.read()
    url = upload_file(contents, file.content_type, folder=f"avatars/{user['id']}")

    db_user = db.query(User).filter(User.id == user["id"]).first()
    db_user.avatar_url = url
    db.commit()

    return {"avatar_url": url}


@router.post("/analyze-clothing")
async def analyze_clothing_endpoint(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Detect clothing category, name, color from image using Gemini Vision."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")
    contents = await file.read()
    content_type = file.content_type
    image_b64 = f"data:{content_type};base64,{base64.b64encode(contents).decode()}"
    result = analyze_clothing(image_b64)
    return result if result else {"name": "", "category": "top", "color": "", "description": ""}


@router.post("/remove-background")
@limiter.limit("10/minute")
async def remove_background_endpoint(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Remove background from clothing image using remove.bg API."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")
    contents = await file.read()
    content_type = file.content_type

    analysis = analyze_and_validate(contents)
    if not analysis.get("is_clothing", True):
        reason = analysis.get("reason", "")
        raise HTTPException(
            status_code=400,
            detail=f"Image does not appear to contain clothing or an accessory. {reason}".strip(),
        )

    clothing_info = {k: analysis.get(k, "") for k in ("name", "category", "color", "season", "description")}

    if not REMOVE_BG_API_KEY:
        # Fallback: return original image if API key not set
        image_b64 = base64.b64encode(contents).decode("utf-8")
        return {
            "status": "success",
            "removed_bg": f"data:{content_type};base64,{image_b64}",
            "size_kb": len(contents) / 1024,
            "clothing_info": clothing_info,
        }

    try:
        response = requests.post(
            "https://api.remove.bg/v1.0/removebg",
            files={"image_file": (file.filename or "upload.png", contents, content_type)},
            data={"size": "auto"},
            headers={"X-Api-Key": REMOVE_BG_API_KEY},
            timeout=90,
        )
        if response.status_code == 200:
            return {
                "status": "success",
                "removed_bg": f"data:image/png;base64,{base64.b64encode(response.content).decode()}",
                "size_kb": len(response.content) / 1024,
                "clothing_info": clothing_info,
            }
        raise HTTPException(status_code=502, detail=f"Remove.bg error: {response.status_code}")
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="remove.bg timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
