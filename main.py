

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import uuid
import time
import random
from datetime import datetime

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
# Mock AI inference
# ─────────────────────────────────────────
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
