import base64
import json
import requests

from ..config import GEMINI_API_KEY

CATEGORY_MAP = {
    "t-shirt": "top", "shirt": "top", "blouse": "top", "top": "top",
    "sweater": "top", "hoodie": "top", "jacket": "outer", "coat": "outer",
    "blazer": "outer", "cardigan": "outer", "pants": "bottom", "jeans": "bottom",
    "trousers": "bottom", "shorts": "bottom", "skirt": "bottom", "dress": "bottom",
    "shoes": "shoes", "sneakers": "shoes", "boots": "shoes", "heels": "shoes",
    "hat": "headwear", "cap": "headwear", "beanie": "headwear",
    "bag": "accessory", "scarf": "accessory", "belt": "accessory",
}


def analyze_clothing(image_base64: str) -> dict:
    """Use Gemini Flash to detect clothing category, name, color from image."""
    if not GEMINI_API_KEY:
        return {}

    # Strip data URL prefix if present
    raw = image_base64.split(",")[1] if image_base64.startswith("data:") else image_base64

    prompt = """Analyze this clothing item image. Return ONLY valid JSON, no markdown:
{
  "name": "short descriptive name (e.g. Black wool coat, White linen shirt)",
  "category": "one of: top, bottom, outer, shoes, headwear, accessory",
  "color": "primary color",
  "description": "detailed description for AI image generation (color, fabric, style, fit)"
}"""

    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": raw}},
                {"text": prompt},
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }

    try:
        r = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
            json=payload,
            headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
            timeout=20,
        )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        return json.loads(text)
    except Exception as e:
        print(f"[vision_service] analyze_clothing error: {e}")
        return {}
