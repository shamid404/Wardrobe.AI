import uuid
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
from ..db.memory_store import WARDROBE_DB, TRYON_JOBS
from ..models.schemas import TryOnRequest, TryOnJobStatus, VirtualTryOnRequest
from ..services.ai_service import generate_virtual_tryon, mock_ai_analysis
from ..services.image_service import upload_to_imgbb, url_to_data_url

router = APIRouter(tags=["tryon"])


@router.post("/tryon", response_model=TryOnJobStatus, status_code=status.HTTP_202_ACCEPTED)
def start_tryon(request: TryOnRequest, user=Depends(get_current_user)):
    """
    Start an async AI try-on job.
    In production this enqueues a Celery task on Redis.
    Here we mock instant processing.
    """
    items = WARDROBE_DB.get(user["id"], [])
    item = next((i for i in items if i["id"] == request.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()

    analysis = mock_ai_analysis(item)

    job = {
        "job_id": job_id,
        "status": "done",
        "result": {
            "analysis": analysis.model_dump(),
            "preview_url": f"https://storage.wardrobe.ai/tryons/{job_id}.jpg",
            "item": item,
        },
        "created_at": now,
        "completed_at": datetime.utcnow().isoformat(),
    }
    TRYON_JOBS[job_id] = job
    return job


@router.get("/tryon/{job_id}", response_model=TryOnJobStatus)
def get_tryon_status(job_id: str, user=Depends(get_current_user)):
    """Poll try-on job status (used for async Celery flow)."""
    job = TRYON_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/generate-tryon")
async def generate_tryon(request: VirtualTryOnRequest, user=Depends(get_current_user)):
    """Generate virtual try-on using Replicate flux-2-pro model."""
    try:
        avatar_url = upload_to_imgbb(request.avatar_image_base64)

        top_url = upload_to_imgbb(request.top_image_base64) if request.top_image_base64 else None
        bottom_url = upload_to_imgbb(request.bottom_image_base64) if request.bottom_image_base64 else None
        outer_url = upload_to_imgbb(request.outer_image_base64) if request.outer_image_base64 else None

        result = await generate_virtual_tryon(
            avatar_url=avatar_url,
            top_url=top_url,
            bottom_url=bottom_url,
            outer_url=outer_url,
            top_name=request.top_name,
            bottom_name=request.bottom_name,
            outer_name=request.outer_name,
        )

        if result["success"]:
            job_id = f"tryon_{uuid.uuid4().hex[:10]}"

            preview_data_url = None
            try:
                if result.get("result_url", "").startswith("http"):
                    preview_data_url = url_to_data_url(result["result_url"])
            except Exception:
                preview_data_url = None

            return {
                "job_id": job_id,
                "status": "completed",
                "preview_url": result["result_url"],
                "preview_image_data_url": preview_data_url,
                "prompt": result["prompt"],
                "fit_score": random.randint(70, 95),
                "style_score": random.randint(75, 95),
                "confidence": random.randint(80, 98),
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
def get_history(user=Depends(get_current_user)):
    """Return all try-on jobs for the current user."""
    return list(TRYON_JOBS.values())
