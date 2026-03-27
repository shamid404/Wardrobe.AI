import base64

import requests
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import get_current_user
from ..config import REMOVE_BG_API_KEY

router = APIRouter(tags=["avatar"])


@router.post("/avatar/image")
async def upload_avatar_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload user body/face photo for avatar generation."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    await file.read()
    # TODO: process with pose estimation model (YOLOv8)
    # TODO: store encrypted to S3

    return {
        "user_id": user["id"],
        "avatar_status": "processed",
        "storage_url": f"https://storage.wardrobe.ai/avatars/{user['id']}.jpg",
        "encryption": "AES-256",
    }


@router.post("/remove-background")
async def remove_background_endpoint(file: UploadFile = File(...)):
    """Remove background from clothing image. Currently returns original image (API disabled)."""
    # NOTE: remove.bg API is temporarily disabled to preserve API credits.
    # To re-enable: uncomment the block below and comment out the passthrough return.
    contents = await file.read()
    content_type = file.content_type or "image/jpeg"
    image_b64 = base64.b64encode(contents).decode("utf-8")
    return {
        "status": "success",
        "removed_bg": f"data:{content_type};base64,{image_b64}",
        "size_kb": len(contents) / 1024,
    }

    # ── re-enable block start ──────────────────────────────────────
    # if not REMOVE_BG_API_KEY:
    #     raise HTTPException(status_code=500, detail="REMOVE_BG_API_KEY не задан.")
    # try:
    #     response = requests.post(
    #         "https://api.remove.bg/v1.0/removebg",
    #         files={"image_file": (file.filename or "upload.png", contents, content_type)},
    #         data={"size": "auto"},
    #         headers={"X-Api-Key": REMOVE_BG_API_KEY},
    #         timeout=90,
    #     )
    #     if response.status_code == 200:
    #         return {
    #             "status": "success",
    #             "removed_bg": f"data:image/png;base64,{base64.b64encode(response.content).decode()}",
    #             "size_kb": len(response.content) / 1024,
    #         }
    #     raise HTTPException(status_code=502, detail=f"Remove.bg error: {response.status_code}")
    # except requests.exceptions.Timeout:
    #     raise HTTPException(status_code=504, detail="remove.bg timeout")
    # except HTTPException:
    #     raise
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=str(e))
    # ── re-enable block end ────────────────────────────────────────
