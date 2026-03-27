# In-memory store (replace with PostgreSQL later)

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
