import base64
import uuid

import cloudinary
import cloudinary.uploader

from ..config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_file(file_bytes: bytes, content_type: str, folder: str = "wardrobe") -> str:
    """Upload bytes to Cloudinary, return public URL."""
    raw_b64 = base64.b64encode(file_bytes).decode("utf-8")
    result = cloudinary.uploader.upload(
        f"data:{content_type};base64,{raw_b64}",
        public_id=f"{folder}/{uuid.uuid4().hex}",
        overwrite=True,
        resource_type="image",
    )
    return result["secure_url"]


def delete_file(url: str) -> None:
    """Delete file from Cloudinary by its URL."""
    try:
        # Extract public_id from URL: .../upload/v123/<public_id>.<ext>
        if "cloudinary.com" not in url:
            return
        path = url.split("/upload/")[-1]
        # Remove version segment (v1234567/) if present
        parts = path.split("/")
        if parts[0].startswith("v") and parts[0][1:].isdigit():
            parts = parts[1:]
        public_id = "/".join(parts).rsplit(".", 1)[0]
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception:
        pass
