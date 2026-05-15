from pydantic import BaseModel, EmailStr
from typing import Optional, List


# ── Auth ──────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Wardrobe ──────────────────────────────

class ClothingItem(BaseModel):
    name: str
    category: str          # top | bottom | outer | shoes | headwear | accessory
    brand: Optional[str] = None
    size: Optional[str] = None


class ClothingItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    size: Optional[str] = None


class ClothingItemOut(BaseModel):
    id: str
    name: str
    category: str
    brand: Optional[str] = None
    size: Optional[str] = None
    image_url: Optional[str] = None
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


class OutfitItemOut(BaseModel):
    item_id: str
    name: str
    category: str
    image_url: Optional[str] = None

class OutfitOut(BaseModel):
    id: str
    name: str
    ai_suggested: bool = False
    created_at: str
    items: List[OutfitItemOut]

class OutfitCreate(BaseModel):
    name: str
    item_ids: List[str]
    ai_suggested: bool = False


class AccessoryItem(BaseModel):
    image_base64: Optional[str] = None
    name: str


class VirtualTryOnRequest(BaseModel):
    avatar_image_base64: str
    outfit_collage_base64: Optional[str] = None
    top_name: Optional[str] = None
    bottom_name: Optional[str] = None
    outer_name: Optional[str] = None
    headwear_name: Optional[str] = None
    shoes_name: Optional[str] = None
    accessories: Optional[List[AccessoryItem]] = None
