import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user
from ..db.database import get_db
from ..db.memory_store import hash_password, verify_password
from ..db.models import User, WardrobeItem
from ..models.schemas import UserRegister, UserLogin, Token, UserOut

# ── Дефолтные вещи для нового пользователя ────────────────────────────────────
# Положи свои фото сюда: backend/static/defaults/
# URL будет доступен как http://localhost:8000/static/defaults/<filename>
_DEFAULT_ITEMS = [
    {"name": "Classic White Tee",   "category": "top",    "brand": "Basics", "size": "M",  "image_file": "default_top.png"},
    {"name": "Slim Jeans",          "category": "bottom", "brand": "Denim",  "size": "32", "image_file": "default_bottom.png"},
    {"name": "Light Blazer",        "category": "outer",  "brand": "Smart",  "size": "M",  "image_file": "default_outer.png"},
]

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован.")

    user = User(
        id=f"user_{uuid.uuid4().hex[:10]}",
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    for item in _DEFAULT_ITEMS:
        db.add(WardrobeItem(
            id=f"item_{uuid.uuid4().hex[:8]}",
            user_id=user.id,
            name=item["name"],
            category=item["category"],
            brand=item["brand"],
            size=item["size"],
            image_url=f"/static/defaults/{item['image_file']}",
        ))
    db.commit()

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut(id=user.id, name=user.name, email=user.email, avatar_url=user.avatar_url))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль.")

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut(id=user.id, name=user.name, email=user.email, avatar_url=user.avatar_url))


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user["id"]).first()
    return UserOut(id=db_user.id, name=db_user.name, email=db_user.email, avatar_url=db_user.avatar_url)
