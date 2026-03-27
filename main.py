

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import uuid
import time
import random
import base64
import requests
import os
import json
from datetime import datetime
import asyncio
import replicate

from config import REMOVE_BG_API_KEY, REPLICATE_API_TOKEN, IMGBB_API_KEY

replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN) if REPLICATE_API_TOKEN else None

app = FastAPI(
    title="Wardrobe.AI API",
    description="Virtual Wardrobe Assistant — AI Try-On Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

# ─────────────────────────────────────────
# In-memory store (replace with PostgreSQL)
# ─────────────────────────────────────────
USERS_DB: dict = {
    "user_demo": {"id": "user_demo", "name": "Dinmukhammed", "email": "demo@wardrobe.ai"}
}

WARDROBE_DB: dict = {
    "user_demo": [
        {"id": "item_1", "name": "Silk Blouse",   "category": "top",    "brand": "Zara",    "size": "M",  "emoji": "👚", "uploaded_at": "2025-01-10"},
        {"id": "item_2", "name": "Linen Blazer",  "category": "outer",  "brand": "Massimo", "size": "M",  "emoji": "🥼", "uploaded_at": "2025-01-11"},
        {"id": "item_3", "name": "Wool Trousers", "category": "bottom", "brand": "Uniqlo",  "size": "30", "emoji": "👖", "uploaded_at": "2025-01-12"},
    ]
}

TRYON_JOBS: dict = {}  # job_id -> job status

# ─────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────
class ClothingItem(BaseModel):
    name: str
    category: str          # top | bottom | outer
    brand: Optional[str] = "Unknown"
    size: Optional[str] = "M"
    emoji: Optional[str] = "👕"

class ClothingItemOut(ClothingItem):
    id: str
    uploaded_at: str

class TryOnRequest(BaseModel):
    item_id: str
    user_id: Optional[str] = "user_demo"

class TryOnJobStatus(BaseModel):
    job_id: str
    status: str            # queued | processing | done | failed
    result: Optional[dict] = None
    created_at: str
    completed_at: Optional[str] = None

class AnalysisResult(BaseModel):
    fit_score: int
    style_score: int
    color_harmony: int
    garment_type: str
    detected_color: str
    fabric: str
    recommendation: str

# ─────────────────────────────────────────
# Auth helper (mock JWT)
# ─────────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    # In production: verify JWT token here
    # For demo, any Bearer token returns demo user
    if credentials is None:
        return USERS_DB["user_demo"]
    return USERS_DB["user_demo"]

# ─────────────────────────────────────────
# Replicate AI Integration
# ─────────────────────────────────────────

async def generate_virtual_tryon(avatar_url: str, top_url: Optional[str] = None, bottom_url: Optional[str] = None, outer_url: Optional[str] = None, top_name: Optional[str] = None, bottom_name: Optional[str] = None, outer_name: Optional[str] = None) -> dict:
    """
    Generate virtual try-on using Replicate flux-2-pro model with prompt-based generation.
    """
    try:
        # Build prompt based on selected clothing
        prompt_parts = ["A person"]

        if top_name and top_url:
            prompt_parts.append(f"wearing {top_name} on upper body")
        if bottom_name and bottom_url:
            prompt_parts.append(f"wearing {bottom_name} on lower body")
        if outer_name and outer_url:
            prompt_parts.append(f"wearing {outer_name} as outerwear")

        prompt = ", ".join(prompt_parts) + ", on neutral background, photorealistic, high quality"

        # Prepare input images (avatar + clothing items)
        input_images = [avatar_url]
        if top_url:
            input_images.append(top_url)
        if bottom_url:
            input_images.append(bottom_url)
        if outer_url:
            input_images.append(outer_url)

        if replicate_client is None:
            raise RuntimeError("REPLICATE_API_TOKEN не задан. Укажите переменную окружения REPLICATE_API_TOKEN.")

        # Use Replicate Python client
        output = replicate_client.run(
            "black-forest-labs/flux-2-pro",
            input={
                "prompt": prompt,
                "input_images": input_images,
                "guidance_scale": 7.5,
                "num_inference_steps": 20,
                "aspect_ratio": "1:1",
                "output_format": "jpg",
                "safety_tolerance": 2,
            },
        )

        # Get the result URL
        if isinstance(output, list) and len(output) > 0:
            result_url = output[0]
        else:
            result_url = str(output)

        return {
            "success": True,
            "result_url": result_url,
            "prediction_id": f"flux_{uuid.uuid4().hex[:10]}",
            "prompt": prompt
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def upload_to_imgbb(image_base64: str) -> str:
    """
    Upload image to imgbb for temporary hosting (needed for Replicate).
    """
    try:
        # Remove data URL prefix if present
        if image_base64.startswith('data:image'):
            image_base64 = image_base64.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(image_base64)
        
        # Upload to imgbb (free image hosting)
        imgbb_url = "https://api.imgbb.com/1/upload"
        if not IMGBB_API_KEY:
            raise HTTPException(
                status_code=400,
                detail="IMGBB_API_KEY не задан. Replicate требует публичные URL для input_images.",
            )
        
        files = {'image': ('clothing.jpg', image_data, 'image/jpeg')}
        data = {'key': IMGBB_API_KEY}
        
        response = requests.post(imgbb_url, files=files, data=data)
        response.raise_for_status()
        
        result = response.json()
        return result['data']['url']
        
    except HTTPException:
        raise
    except Exception as e:
        # Return explicit error (data: URL обычно не подходит для Replicate)
        raise HTTPException(status_code=502, detail=f"Не удалось загрузить изображение в imgbb: {e}") from e


def url_to_data_url(image_url: str) -> str:
    r = requests.get(image_url, timeout=60)
    r.raise_for_status()
    content_type = r.headers.get("content-type", "image/jpeg")
    b64 = base64.b64encode(r.content).decode("utf-8")
    return f"data:{content_type};base64,{b64}"
def mock_ai_analysis(item: dict) -> AnalysisResult:
    colors = ["Warm beige", "Deep navy", "Ivory white", "Charcoal grey", "Terracotta"]
    fabrics = ["Cotton blend", "Pure silk", "Linen", "Wool", "Polyester mix"]
    type_map = {"top": "Upper body", "bottom": "Lower body", "outer": "Outerwear"}
    recs = [
        "Great fit for your body type!",
        "Pairs well with neutral tones.",
        "Consider layering with a blazer.",
        "Perfect for casual occasions.",
        "Excellent color harmony detected.",
    ]
    return AnalysisResult(
        fit_score=random.randint(78, 97),
        style_score=random.randint(75, 95),
        color_harmony=random.randint(80, 98),
        garment_type=type_map.get(item.get("category", "top"), "Unknown"),
        detected_color=random.choice(colors),
        fabric=random.choice(fabrics),
        recommendation=random.choice(recs),
    )

# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def root():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── Wardrobe ──────────────────────────────

@app.get("/wardrobe", response_model=List[ClothingItemOut])
def get_wardrobe(user=Depends(get_current_user)):
    """Return all clothing items for the current user."""
    return WARDROBE_DB.get(user["id"], [])


@app.post("/wardrobe", response_model=ClothingItemOut, status_code=status.HTTP_201_CREATED)
def add_clothing(item: ClothingItem, user=Depends(get_current_user)):
    """Add a new clothing item (metadata only)."""
    new_item = {
        "id": f"item_{uuid.uuid4().hex[:8]}",
        "uploaded_at": datetime.utcnow().date().isoformat(),
        **item.model_dump(),
    }
    WARDROBE_DB.setdefault(user["id"], []).append(new_item)
    return new_item


@app.delete("/wardrobe/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing(item_id: str, user=Depends(get_current_user)):
    """Remove a clothing item from the wardrobe."""
    items = WARDROBE_DB.get(user["id"], [])
    updated = [i for i in items if i["id"] != item_id]
    if len(updated) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    WARDROBE_DB[user["id"]] = updated


# ── Image Upload ──────────────────────────

@app.post("/wardrobe/{item_id}/image")
async def upload_clothing_image(
    item_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload a clothing photo. In production: store to S3-compatible storage."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    contents = await file.read()
    size_kb = len(contents) / 1024

    # TODO: upload contents to MinIO / S3
    # s3_client.put_object(bucket, f"{user['id']}/{item_id}.jpg", contents)

    return {
        "item_id": item_id,
        "filename": file.filename,
        "size_kb": round(size_kb, 1),
        "storage_url": f"https://storage.wardrobe.ai/{user['id']}/{item_id}.jpg",  # mock
        "status": "uploaded",
    }


@app.post("/avatar/image")
async def upload_avatar_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """Upload user body/face photo for avatar generation."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    contents = await file.read()
    # TODO: process with pose estimation model (YOLOv8)
    # TODO: store encrypted to S3

    return {
        "user_id": user["id"],
        "avatar_status": "processed",
        "storage_url": f"https://storage.wardrobe.ai/avatars/{user['id']}.jpg",
        "encryption": "AES-256",
    }


# ── Virtual Try-On with Replicate API ─────

class VirtualTryOnRequest(BaseModel):
    avatar_image_base64: str    # Base64 encoded avatar/body image
    top_image_base64: Optional[str] = None     # Base64 encoded top clothing
    bottom_image_base64: Optional[str] = None  # Base64 encoded bottom clothing  
    outer_image_base64: Optional[str] = None   # Base64 encoded outer clothing
    top_name: Optional[str] = None
    bottom_name: Optional[str] = None
    outer_name: Optional[str] = None


@app.post("/remove-background")
async def remove_background_endpoint(file: UploadFile = File(...)):
    """Remove background from clothing image using remove.bg API."""
    if not REMOVE_BG_API_KEY:
        raise HTTPException(status_code=500, detail="REMOVE_BG_API_KEY не задан. Проверьте .env или config.py")

    try:
        contents = await file.read()

        # file.content_type иногда может быть None, тогда используем jpeg
        content_type = file.content_type or "image/jpeg"
        file_name = file.filename or "upload.png"

        # Call remove.bg API
        response = requests.post(
            'https://api.remove.bg/v1.0/removebg',
            files={
                'image_file': (file_name, contents, content_type),
            },
            data={'size': 'auto'},
            headers={'X-Api-Key': REMOVE_BG_API_KEY},
            timeout=90,
        )

        if response.status_code == 200:
            removed_bg_base64 = base64.b64encode(response.content).decode('utf-8')
            return {
                "status": "success",
                "removed_bg": f"data:image/png;base64,{removed_bg_base64}",
                "size_kb": len(response.content) / 1024,
            }

        detail = f"Remove.bg error: {response.status_code} - {response.text}"
        print(detail)
        raise HTTPException(status_code=502, detail=detail)

    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="remove.bg timeout, повторите запрос позже")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Ошибка обращения к remove.bg: {e}")
    except Exception as e:
        error_msg = f"remove-background failed: {e}"
        print(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.post("/generate-tryon")
async def generate_tryon(request: VirtualTryOnRequest, user=Depends(get_current_user)):
    """
    Generate virtual try-on using Replicate flux-2-pro model with prompt-based generation.
    """
    try:
        # Upload avatar image
        avatar_url = upload_to_imgbb(request.avatar_image_base64)
        
        # Upload clothing images if provided
        top_url = upload_to_imgbb(request.top_image_base64) if request.top_image_base64 else None
        bottom_url = upload_to_imgbb(request.bottom_image_base64) if request.bottom_image_base64 else None
        outer_url = upload_to_imgbb(request.outer_image_base64) if request.outer_image_base64 else None
        
        # Generate virtual try-on
        result = await generate_virtual_tryon(
            avatar_url=avatar_url,
            top_url=top_url,
            bottom_url=bottom_url,
            outer_url=outer_url,
            top_name=request.top_name,
            bottom_name=request.bottom_name,
            outer_name=request.outer_name
        )
        
        if result["success"]:
            job_id = f"tryon_{uuid.uuid4().hex[:10]}"
            
            preview_data_url = None
            try:
                if result.get("result_url", "").startswith("http"):
                    preview_data_url = url_to_data_url(result["result_url"])
            except Exception:
                preview_data_url = None

            tryon_result = {
                "job_id": job_id,
                "status": "completed",
                "preview_url": result["result_url"],
                "preview_image_data_url": preview_data_url,
                "prompt": result["prompt"],
                "fit_score": random.randint(70, 95),
                "style_score": random.randint(75, 95),
                "confidence": random.randint(80, 98),
                "prediction_id": result["prediction_id"]
            }
            
            return tryon_result
        else:
            raise HTTPException(status_code=502, detail={"message": "AI generation failed", "error": result.get("error")})
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Try-On ─────────────────────────────

@app.post("/tryon", response_model=TryOnJobStatus, status_code=status.HTTP_202_ACCEPTED)
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

    # Mock: immediately complete (real: Celery task)
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


@app.get("/tryon/{job_id}", response_model=TryOnJobStatus)
def get_tryon_status(job_id: str, user=Depends(get_current_user)):
    """Poll try-on job status (used for async Celery flow)."""
    job = TRYON_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ── Try-On History ────────────────────────

@app.get("/history")
def get_history(user=Depends(get_current_user)):
    """Return all try-on jobs for the current user."""
    return list(TRYON_JOBS.values())


# ─────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
