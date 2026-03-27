from pydantic import BaseModel
from typing import Optional


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


class VirtualTryOnRequest(BaseModel):
    avatar_image_base64: str
    top_image_base64: Optional[str] = None
    bottom_image_base64: Optional[str] = None
    outer_image_base64: Optional[str] = None
    top_name: Optional[str] = None
    bottom_name: Optional[str] = None
    outer_name: Optional[str] = None
