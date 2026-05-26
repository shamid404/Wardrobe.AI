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

_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.5-flash"]


def _call_gemini(payload: dict) -> dict | None:
    """Try each model in order, return parsed JSON or None if all fail."""
    for model in _MODELS:
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                timeout=20,
            )
            print(f"[gemini] {model} → {r.status_code}")
            if r.status_code == 429:
                continue
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            print(f"[gemini] response: {text[:120]}")
            return json.loads(text)
        except Exception as e:
            print(f"[gemini] {model} error: {e}")
            continue
    print("[gemini] all models failed")
    return None


def analyze_and_validate(image_bytes: bytes) -> dict:
    """Single Gemini call: validates clothing + extracts metadata.

    Returns dict with keys:
      is_clothing (bool), reason (str),
      name, category, color, season, description
    """
    if not GEMINI_API_KEY:
        return {"is_clothing": True, "reason": "", "name": "", "category": "top",
                "color": "", "season": "", "description": ""}

    raw = base64.b64encode(image_bytes).decode()

    prompt = """Analyze this image. Return ONLY valid JSON, no markdown:
{
  "is_clothing": true,
  "reason": "",
  "name": "short descriptive name (e.g. Black wool coat, White linen shirt)",
  "category": "one of: top, bottom, outer, shoes, headwear, accessory",
  "color": "one of: White, Black, Grey, Navy, Blue, Green, Red, Pink, Yellow, Orange, Purple, Brown, Beige, Multicolor",
  "season": "one of: Spring, Summer, Autumn, Winter, All seasons",
  "description": "detailed description for AI image generation (color, fabric, style, fit)"
}

Rules:
- Set is_clothing to false if the image does NOT show clothing, footwear, or an accessory (bag, hat, belt, etc.)
- If is_clothing is false, set reason to a short explanation and leave other fields empty
- If is_clothing is true, fill all fields"""

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

    result = _call_gemini(payload)
    if result is None:
        return {"is_clothing": True, "reason": "", "name": "", "category": "top",
                "color": "", "season": "", "description": ""}
    return result


def analyze_clothing(image_base64: str) -> dict:
    """Legacy wrapper — used by /analyze-clothing endpoint."""
    if not GEMINI_API_KEY:
        return {}
    raw = image_base64.split(",")[1] if image_base64.startswith("data:") else image_base64
    image_bytes = base64.b64decode(raw)
    result = analyze_and_validate(image_bytes)
    if not result.get("is_clothing", True):
        return {}
    return {k: result.get(k, "") for k in ("name", "category", "color", "season", "description")}
