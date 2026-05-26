from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal


# ── Auth ──────────────────────────────────

class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class SendVerificationCode(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class VerifyEmailCode(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)

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

_CATEGORY = Literal["top", "bottom", "outer", "shoes", "headwear", "accessory"]


class ClothingItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: _CATEGORY
    brand: Optional[str] = Field(default=None, max_length=100)
    size: Optional[str] = Field(default=None, max_length=20)
    color: Optional[str] = Field(default=None, max_length=50)
    season: Optional[str] = Field(default=None, max_length=50)


class ClothingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[_CATEGORY] = None
    brand: Optional[str] = Field(default=None, max_length=100)
    size: Optional[str] = Field(default=None, max_length=20)
    color: Optional[str] = Field(default=None, max_length=50)
    season: Optional[str] = Field(default=None, max_length=50)


class ClothingItemOut(BaseModel):
    id: str
    name: str
    category: str
    brand: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = None
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
