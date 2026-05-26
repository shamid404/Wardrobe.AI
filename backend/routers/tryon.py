import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import TryOnHistory
from ..models.schemas import VirtualTryOnRequest
from ..services.ai_service import generate_virtual_tryon
from ..services.image_service import upload_to_cloudinary, url_to_data_url

router = APIRouter(tags=["tryon"])


@router.post("/generate-tryon")
@limiter.limit("5/minute")
async def generate_tryon(request: Request, body: VirtualTryOnRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate virtual try-on using Replicate flux-2-pro model."""
    try:
        avatar_url = upload_to_cloudinary(body.avatar_image_base64)
        outfit_collage_url = upload_to_cloudinary(body.outfit_collage_base64) if body.outfit_collage_base64 else None

        accessory_names = [a.name for a in body.accessories] if body.accessories else []

        result = await generate_virtual_tryon(
            avatar_url=avatar_url,
            outfit_collage_url=outfit_collage_url,
            top_name=body.top_name,
            bottom_name=body.bottom_name,
            outer_name=body.outer_name,
            headwear_name=body.headwear_name,
            shoes_name=body.shoes_name,
            accessory_names=accessory_names,
        )

        if result["success"]:
            job_id = f"tryon_{uuid.uuid4().hex[:10]}"

            # Upload to Cloudinary for permanent storage (Replicate URLs expire)
            stored_url = result["result_url"]
            try:
                stored_url = upload_to_cloudinary(result["result_url"])
            except Exception as e:
                print(f"[tryon] Cloudinary upload failed, falling back to Replicate URL: {e}")

            preview_data_url = None
            try:
                if stored_url.startswith("http"):
                    preview_data_url = url_to_data_url(stored_url)
            except Exception:
                preview_data_url = None

            db.add(TryOnHistory(
                id=job_id,
                user_id=user["id"],
                preview_url=stored_url,
                prompt=result.get("prompt"),
            ))
            db.commit()

            return {
                "job_id": job_id,
                "status": "completed",
                "preview_url": result["result_url"],
                "preview_image_data_url": preview_data_url,
                "prompt": result["prompt"],
                "prediction_id": result["prediction_id"],
            }
        elif result.get("content_flagged"):
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Изображение не прошло проверку контента AI-модели. Попробуйте другое фото одежды.",
                    "code": "CONTENT_FLAGGED",
                },
            )
        else:
            raise HTTPException(
                status_code=502,
                detail={"message": "AI generation failed", "error": result.get("error")},
            )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/history")
def get_history(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return try-on history for the current user."""
    rows = (
        db.query(TryOnHistory)
        .filter(TryOnHistory.user_id == user["id"])
        .order_by(TryOnHistory.created_at.desc())
        .all()
    )
    return [
        {
            "job_id": r.id,
            "status": "completed",
            "preview_url": r.preview_url,
            "prompt": r.prompt,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.delete("/history")
def clear_history(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete all try-on history for the current user."""
    db.query(TryOnHistory).filter(TryOnHistory.user_id == user["id"]).delete()
    db.commit()
    return {"deleted": True}
