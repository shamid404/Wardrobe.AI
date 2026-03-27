import base64

import requests
from fastapi import HTTPException

from ..config import IMGBB_API_KEY


def upload_to_imgbb(image_base64: str) -> str:
    """Upload image to imgbb for temporary hosting (needed for Replicate)."""
    try:
        if image_base64.startswith("data:image"):
            image_base64 = image_base64.split(",")[1]

        image_data = base64.b64decode(image_base64)

        if not IMGBB_API_KEY:
            raise HTTPException(
                status_code=400,
                detail="IMGBB_API_KEY не задан. Replicate требует публичные URL для input_images.",
            )

        files = {"image": ("clothing.jpg", image_data, "image/jpeg")}
        data = {"key": IMGBB_API_KEY}

        response = requests.post("https://api.imgbb.com/1/upload", files=files, data=data)
        response.raise_for_status()

        result = response.json()
        return result["data"]["url"]

    except HTTPException:
        raise
    except Exception as e:
        print(f"[image_service] upload_to_imgbb error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Не удалось загрузить изображение в imgbb: {e}") from e


def url_to_data_url(image_url: str) -> str:
    r = requests.get(image_url, timeout=60)
    r.raise_for_status()
    content_type = r.headers.get("content-type", "image/jpeg")
    b64 = base64.b64encode(r.content).decode("utf-8")
    return f"data:{content_type};base64,{b64}"
