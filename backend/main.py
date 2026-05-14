from datetime import datetime

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import wardrobe, tryon, avatar, auth_router
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


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
