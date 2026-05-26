import io
import os
import uuid
from typing import Optional

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..config import MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET

_s3 = boto3.client(
    "s3",
    endpoint_url=f"http://{MINIO_ENDPOINT}",
    aws_access_key_id=MINIO_ACCESS_KEY,
    aws_secret_access_key=MINIO_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)


_EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

_MINIO_PUBLIC = os.getenv("MINIO_PUBLIC_BUCKET", "true").lower() == "true"


def ensure_bucket() -> None:
    """Create bucket if it doesn't exist yet."""
    try:
        _s3.head_bucket(Bucket=MINIO_BUCKET)
    except ClientError:
        _s3.create_bucket(Bucket=MINIO_BUCKET)
        if _MINIO_PUBLIC:
            # Public only in dev. In production set MINIO_PUBLIC_BUCKET=false
            # and serve images via presigned URLs.
            _s3.put_bucket_policy(
                Bucket=MINIO_BUCKET,
                Policy=f'''{{
                    "Version":"2012-10-17",
                    "Statement":[{{
                        "Effect":"Allow",
                        "Principal":"*",
                        "Action":"s3:GetObject",
                        "Resource":"arn:aws:s3:::{MINIO_BUCKET}/*"
                    }}]
                }}''',
            )


def upload_file(file_bytes: bytes, content_type: str, folder: str = "wardrobe") -> str:
    """Upload bytes to MinIO, return public URL."""
    ensure_bucket()
    ext = _EXT_MAP.get(content_type, "jpg")
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"
    _s3.put_object(
        Bucket=MINIO_BUCKET,
        Key=key,
        Body=io.BytesIO(file_bytes),
        ContentType=content_type,
    )
    return f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{key}"


def delete_file(url: str) -> None:
    """Delete file from MinIO by its full URL."""
    try:
        prefix = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/"
        if url.startswith(prefix):
            key = url[len(prefix):]
            _s3.delete_object(Bucket=MINIO_BUCKET, Key=key)
    except ClientError:
        pass
