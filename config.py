import os
from dotenv import load_dotenv

load_dotenv()

REMOVE_BG_API_KEY = os.getenv("REMOVE_BG_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY", "")

# для безопасности можно добавить проверку тут:
if not REPLICATE_API_TOKEN:
    print("WARNING: REPLICATE_API_TOKEN is not set. /generate-tryon will fail with auth.")
if not IMGBB_API_KEY:
    print("WARNING: IMGBB_API_KEY is not set. image upload to imgbb may fail.")
