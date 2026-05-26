import uuid
import random
import time
import threading

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
from sqlalchemy.orm import Session

import uuid as uuid_lib
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from fastapi.security import HTTPAuthorizationCredentials
from ..auth import create_access_token, get_current_user, revoke_token, security
from ..config import GOOGLE_CLIENT_ID
from ..db.database import get_db
from ..db.memory_store import hash_password, verify_password
from ..db.models import User, WardrobeItem
from ..models.schemas import UserRegister, UserLogin, Token, UserOut, SendVerificationCode, VerifyEmailCode
from ..services.minio_service import upload_file, delete_file
from ..services.email_service import send_verification_email

# In-memory store for pending registrations {email -> {name, hashed_password, code, expires_at}}
_pending: dict = {}
_pending_lock = threading.Lock()

# ── Дефолтные вещи для нового пользователя ────────────────────────────────────
# Положи свои фото сюда: backend/static/defaults/
# URL будет доступен как http://localhost:8000/static/defaults/<filename>
_DEFAULT_ITEMS = [
    {"name": "Classic White Tee",   "category": "top",    "brand": "Basics", "size": "M",  "image_file": "default_top.png"},
    {"name": "Slim Jeans",          "category": "bottom", "brand": "Denim",  "size": "32", "image_file": "default_bottom.png"},
    {"name": "Light Blazer",        "category": "outer",  "brand": "Smart",  "size": "M",  "image_file": "default_outer.png"},
]

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/send-code", status_code=200)
@limiter.limit("3/minute")
def send_code(request: Request, data: SendVerificationCode, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован.")

    code = "".join(str(random.randint(0, 9)) for _ in range(6))
    expires_at = time.time() + 600  # 10 minutes

    with _pending_lock:
        _pending[data.email] = {
            "name": data.name,
            "hashed_password": hash_password(data.password),
            "code": code,
            "expires_at": expires_at,
        }

    try:
        send_verification_email(data.email, code, data.name)
    except Exception as exc:
        with _pending_lock:
            _pending.pop(data.email, None)
        raise HTTPException(status_code=500, detail=f"Не удалось отправить письмо: {exc}")

    return {"message": "Код отправлен на ваш email"}


@router.post("/verify-email", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def verify_email(request: Request, data: VerifyEmailCode, db: Session = Depends(get_db)):
    with _pending_lock:
        pending = _pending.get(data.email)

    if not pending:
        raise HTTPException(status_code=400, detail="Код не найден. Запросите новый.")

    if time.time() > pending["expires_at"]:
        with _pending_lock:
            _pending.pop(data.email, None)
        raise HTTPException(status_code=400, detail="Код истёк. Запросите новый.")

    if pending["code"] != data.code:
        raise HTTPException(status_code=400, detail="Неверный код.")

    with _pending_lock:
        _pending.pop(data.email, None)

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован.")

    user = User(
        id=f"user_{uuid.uuid4().hex[:10]}",
        name=pending["name"],
        email=data.email,
        hashed_password=pending["hashed_password"],
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


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, data: UserRegister, db: Session = Depends(get_db)):
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
@limiter.limit("10/minute")
def login(request: Request, data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль.")

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut(id=user.id, name=user.name, email=user.email, avatar_url=user.avatar_url))


@router.post("/google", response_model=Token)
@limiter.limit("10/minute")
def google_auth(request: Request, body: dict, db: Session = Depends(get_db)):
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), GOOGLE_CLIENT_ID)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = info.get("email")
    name = info.get("name", email.split("@")[0])
    avatar = info.get("picture")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=f"user_{uuid_lib.uuid4().hex[:10]}",
            name=name,
            email=email,
            hashed_password=hash_password(uuid_lib.uuid4().hex),
            avatar_url=avatar,
        )
        db.add(user)
        db.flush()
        for item in _DEFAULT_ITEMS:
            db.add(WardrobeItem(
                id=f"item_{uuid_lib.uuid4().hex[:8]}",
                user_id=user.id,
                name=item["name"],
                category=item["category"],
                brand=item["brand"],
                size=item["size"],
                image_url=f"/static/defaults/{item['image_file']}",
            ))
        db.commit()
    else:
        if avatar and not user.avatar_url:
            user.avatar_url = avatar
            db.commit()

    db.refresh(user)
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut(id=user.id, name=user.name, email=user.email, avatar_url=user.avatar_url))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    _user=Depends(get_current_user),
):
    if credentials:
        revoke_token(credentials.credentials)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the authenticated user and all their data."""
    db.query(User).filter(User.id == user["id"]).delete(synchronize_session=False)
    db.commit()
    if credentials:
        revoke_token(credentials.credentials)


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user["id"]).first()
    return UserOut(id=db_user.id, name=db_user.name, email=db_user.email, avatar_url=db_user.avatar_url)


@router.post("/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP allowed")

    db_user = db.query(User).filter(User.id == user["id"]).first()

    if db_user.avatar_url and db_user.avatar_url.startswith("/"):
        try:
            delete_file(db_user.avatar_url)
        except Exception:
            pass

    contents = await file.read()
    url = upload_file(contents, file.content_type, folder=f"avatars/{user['id']}")
    db_user.avatar_url = url
    db.commit()
    db.refresh(db_user)
    return UserOut(id=db_user.id, name=db_user.name, email=db_user.email, avatar_url=db_user.avatar_url)
