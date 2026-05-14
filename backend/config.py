import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://wardrobe_user:wardrobe_pass@localhost:5432/wardrobe")
MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "wardrobe_minio")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "wardrobe_minio_secret")
MINIO_BUCKET     = os.getenv("MINIO_BUCKET", "wardrobe")
REMOVE_BG_API_KEY = os.getenv("REMOVE_BG_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

# JWT
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа

if not REPLICATE_API_TOKEN:
    print("WARNING: REPLICATE_API_TOKEN is not set. /generate-tryon will fail with auth.")
if not IMGBB_API_KEY:
    print("WARNING: IMGBB_API_KEY is not set. image upload to imgbb may fail.")
