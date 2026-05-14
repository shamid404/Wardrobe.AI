import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import TryOnHistory
from ..models.schemas import VirtualTryOnRequest
from ..services.ai_service import generate_virtual_tryon
from ..services.image_service import upload_to_cloudinary, url_to_data_url

router = APIRouter(tags=["tryon"])


@router.post("/generate-tryon")
async def generate_tryon(request: VirtualTryOnRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate virtual try-on using Replicate flux-2-pro model."""
    try:
        avatar_url = upload_to_cloudinary(request.avatar_image_base64)

        top_url = upload_to_cloudinary(request.top_image_base64) if request.top_image_base64 else None
        bottom_url = upload_to_cloudinary(request.bottom_image_base64) if request.bottom_image_base64 else None
        outer_url = upload_to_cloudinary(request.outer_image_base64) if request.outer_image_base64 else None
        headwear_url = upload_to_cloudinary(request.headwear_image_base64) if request.headwear_image_base64 else None
        shoes_url = upload_to_cloudinary(request.shoes_image_base64) if request.shoes_image_base64 else None

        uploaded_accessories = []
        if request.accessories:
            for acc in request.accessories:
                url = upload_to_cloudinary(acc.image_base64) if acc.image_base64 else None
                uploaded_accessories.append({"url": url, "name": acc.name})

        result = await generate_virtual_tryon(
            avatar_url=avatar_url,
            top_url=top_url,
            bottom_url=bottom_url,
            outer_url=outer_url,
            top_name=request.top_name,
            bottom_name=request.bottom_name,
            outer_name=request.outer_name,
            headwear_url=headwear_url,
            headwear_name=request.headwear_name,
            shoes_url=shoes_url,
            shoes_name=request.shoes_name,
            accessories=uploaded_accessories or None,
        )

        if result["success"]:
            job_id = f"tryon_{uuid.uuid4().hex[:10]}"

            preview_data_url = None
            try:
                if result.get("result_url", "").startswith("http"):
                    preview_data_url = url_to_data_url(result["result_url"])
            except Exception:
                preview_data_url = None

            db.add(TryOnHistory(
                id=job_id,
                user_id=user["id"],
                preview_url=result["result_url"],
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
