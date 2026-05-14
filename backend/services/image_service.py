import base64
import uuid

import cloudinary
import cloudinary.uploader
import requests
from fastapi import HTTPException

from ..config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_to_cloudinary(image_base64: str) -> str:
    """Upload image to Cloudinary for temporary hosting (needed for Replicate)."""
    try:
        if not CLOUDINARY_CLOUD_NAME:
            raise HTTPException(status_code=400, detail="CLOUDINARY_CLOUD_NAME не задан.")

        # If it's a real HTTP(S) URL — Cloudinary can fetch it directly
        if image_base64.startswith(("http://", "https://")):
            result = cloudinary.uploader.upload(
                image_base64,
                public_id=f"tryon/{uuid.uuid4().hex}",
                overwrite=True,
                resource_type="image",
            )
            return result["secure_url"]

        # Strip data-URL prefix if present, then upload as base64
        raw = image_base64.split(",")[1] if image_base64.startswith("data:") else image_base64
        result = cloudinary.uploader.upload(
            f"data:image/jpeg;base64,{raw}",
            public_id=f"tryon/{uuid.uuid4().hex}",
            overwrite=True,
            resource_type="image",
        )
        return result["secure_url"]

    except HTTPException:
        raise
    except Exception as e:
        print(f"[image_service] upload error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Не удалось загрузить изображение: {e}") from e


def url_to_data_url(image_url: str) -> str:
    r = requests.get(image_url, timeout=60)
    r.raise_for_status()
    content_type = r.headers.get("content-type", "image/jpeg")
    b64 = base64.b64encode(r.content).decode("utf-8")
    return f"data:{content_type};base64,{b64}"
