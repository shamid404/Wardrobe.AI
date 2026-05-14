import base64

import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import REMOVE_BG_API_KEY
from ..db.database import get_db
from ..db.models import User
from ..services.minio_service import upload_file

router = APIRouter(tags=["avatar"])


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


@router.post("/remove-background")
async def remove_background_endpoint(file: UploadFile = File(...)):
    """Remove background from clothing image using remove.bg API."""
    contents = await file.read()
    content_type = file.content_type or "image/jpeg"

    if not REMOVE_BG_API_KEY:
        # Fallback: return original image if API key not set
        image_b64 = base64.b64encode(contents).decode("utf-8")
        return {
            "status": "success",
            "removed_bg": f"data:{content_type};base64,{image_b64}",
            "size_kb": len(contents) / 1024,
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
            }
        raise HTTPException(status_code=502, detail=f"Remove.bg error: {response.status_code}")
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="remove.bg timeout")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
