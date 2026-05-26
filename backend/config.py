import os
import sys
from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

_raw_db_url = os.getenv("DATABASE_URL", "postgresql+psycopg://wardrobe_user:wardrobe_pass@localhost:5432/wardrobe")
# Railway provides postgresql:// — rewrite to use psycopg3 driver
DATABASE_URL = (
    _raw_db_url
    .replace("postgres://", "postgresql+psycopg://", 1)
    .replace("postgresql://", "postgresql+psycopg://", 1)
)
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
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]

# SMTP (email verification)
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM     = os.getenv("SMTP_FROM", "")

# JWT
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 часов

_INSECURE_DEFAULT = "change-me-in-production"
if SECRET_KEY == _INSECURE_DEFAULT:
    if ENVIRONMENT == "production":
        print("FATAL: SECRET_KEY is using the insecure default. Set the SECRET_KEY env var.")
        sys.exit(1)
    else:
        print("WARNING: SECRET_KEY is using the insecure default. Set SECRET_KEY env var before deploying.")

if not REPLICATE_API_TOKEN:
    print("WARNING: REPLICATE_API_TOKEN is not set. /generate-tryon will fail with auth.")
if not IMGBB_API_KEY:
    print("WARNING: IMGBB_API_KEY is not set. image upload to imgbb may fail.")
