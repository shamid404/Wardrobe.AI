from datetime import datetime
from urllib.parse import urlparse

import os
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .config import ENVIRONMENT, ALLOWED_ORIGINS
from .auth import get_current_user

from .routers import wardrobe, tryon, avatar, auth_router, assistant, outfits, chat_sessions
from .db.database import engine
from .db import models

models.Base.metadata.create_all(bind=engine)


limiter = Limiter(key_func=get_remote_address)

_is_prod = ENVIRONMENT == "production"
app = FastAPI(
    title="Wardrobe.AI API",
    description="Virtual Wardrobe Assistant — AI Try-On Backend",
    version="1.0.0",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 MB

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(status_code=413, content={"detail": "File too large. Maximum size is 20MB."})
    return await call_next(request)

_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_static_dir, "defaults"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

app.include_router(auth_router.router)
app.include_router(wardrobe.router)
app.include_router(tryon.router)
app.include_router(avatar.router)
app.include_router(assistant.router)
app.include_router(outfits.router)
app.include_router(chat_sessions.router)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/weather")
@limiter.limit("30/minute")
def get_weather(request: Request, lat: float, lon: float):
    """Fetch current weather from Open-Meteo (no API key required)."""
    import requests
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,weathercode,windspeed_10m,relative_humidity_2m",
                "timezone": "auto",
            },
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        current = data["current"]
        code = current["weathercode"]

        # WMO weather code → human readable description
        def wmo_description(c: int) -> str:
            if c == 0: return "Clear sky"
            if c in (1, 2, 3): return "Partly cloudy"
            if c in (45, 48): return "Foggy"
            if c in (51, 53, 55): return "Drizzle"
            if c in (61, 63, 65): return "Rain"
            if c in (71, 73, 75): return "Snow"
            if c in (80, 81, 82): return "Rain showers"
            if c in (95, 96, 99): return "Thunderstorm"
            return "Cloudy"

        return {
            "temperature": round(current["temperature_2m"]),
            "description": wmo_description(code),
            "windspeed": round(current["windspeed_10m"]),
            "humidity": current["relative_humidity_2m"],
            "unit": "°C",
        }
    except Exception:
        raise HTTPException(status_code=502, detail="Weather service unavailable")


@app.get("/proxy-image")
def proxy_image(url: str, _user=Depends(get_current_user)):
    """Proxy external images to avoid browser CORS restrictions on canvas."""
    import requests
    parsed = urlparse(url)
    allowed_hosts = {"res.cloudinary.com"}
    host = parsed.netloc
    if not any(host.endswith(h) for h in allowed_hosts):
        raise HTTPException(status_code=400, detail="URL not allowed.")
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg")
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image URLs are allowed.")
        return Response(content=r.content, media_type=content_type)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to proxy image.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
