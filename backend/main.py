from datetime import datetime

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import wardrobe, tryon, avatar, auth_router, assistant, outfits, chat_sessions
from .db.database import engine
from .db import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Wardrobe.AI API",
    description="Virtual Wardrobe Assistant — AI Try-On Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def get_weather(lat: float, lon: float):
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
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}")


@app.get("/proxy-image")
def proxy_image(url: str):
    """Proxy external images (e.g. MinIO) to avoid browser CORS restrictions on canvas."""
    import requests
    from fastapi.responses import Response
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        return Response(
            content=r.content,
            media_type=r.headers.get("content-type", "image/jpeg"),
        )
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail=f"Failed to proxy image: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
