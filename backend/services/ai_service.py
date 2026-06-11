import uuid
import random
from typing import Optional, List

import replicate

from ..config import REPLICATE_API_TOKEN
from ..models.schemas import AnalysisResult

replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN) if REPLICATE_API_TOKEN else None


def _build_prompt(
    top_name: Optional[str],
    bottom_name: Optional[str],
    outer_name: Optional[str],
    headwear_name: Optional[str],
    shoes_name: Optional[str],
    accessory_names: Optional[List[str]],
    generation_mode: str,
) -> str:
    parts = ["A real person wearing an outfit"]
    if top_name:
        parts.append(f"{top_name} on upper body")
    if outer_name:
        parts.append(f"{outer_name} as outerwear")
    if bottom_name:
        parts.append(f"{bottom_name} on lower body")
    if headwear_name:
        parts.append(f"{headwear_name} on head")
    if shoes_name:
        parts.append(f"{shoes_name} on feet")
    if accessory_names:
        parts.append(f"with {', '.join(accessory_names)}")

    if generation_mode == "original":
        ending = (
            ". Use the reference outfit image as the primary visual guide — reproduce the exact garment appearance,"
            " colors, patterns, and textures shown in the photo, not brand associations."
            " Full body shot, preserve the original background and environment from the person photo,"
            " natural candid pose, photorealistic."
        )
    else:
        ending = (
            ". Use the reference outfit image as the primary visual guide — reproduce the exact garment appearance,"
            " colors, patterns, and textures shown in the photo, not brand associations."
            " Full body shot, plain neutral background, photorealistic fashion photography."
        )

    return ", ".join(parts) + ending


async def generate_virtual_tryon(
    avatar_url: str,
    outfit_collage_url: Optional[str] = None,
    top_name: Optional[str] = None,
    bottom_name: Optional[str] = None,
    outer_name: Optional[str] = None,
    headwear_name: Optional[str] = None,
    shoes_name: Optional[str] = None,
    accessory_names: Optional[List[str]] = None,
    generation_mode: str = "studio",
    model_id: str = "flux-2-pro",
) -> dict:
    if replicate_client is None:
        raise RuntimeError("REPLICATE_API_TOKEN is not set.")

    prompt = _build_prompt(
        top_name, bottom_name, outer_name,
        headwear_name, shoes_name, accessory_names,
        generation_mode,
    )
    images = [avatar_url] + ([outfit_collage_url] if outfit_collage_url else [])

    try:
        if model_id == "nano-banana-2":
            output = replicate_client.run(
                "google/nano-banana-2",
                input={
                    "prompt": prompt,
                    "image_input": images[:14],
                    "aspect_ratio": "9:16",
                    "resolution": "1K",
                    "output_format": "jpg",
                },
            )
            prediction_id = f"nano_{uuid.uuid4().hex[:10]}"
        else:
            output = replicate_client.run(
                "black-forest-labs/flux-2-pro",
                input={
                    "prompt": prompt,
                    "input_images": images[:2],
                    "guidance_scale": 7.5,
                    "num_inference_steps": 20,
                    "aspect_ratio": "1:1",
                    "output_format": "jpg",
                    "safety_tolerance": 5,
                },
            )
            prediction_id = f"flux_{uuid.uuid4().hex[:10]}"

        result_url = output[0] if isinstance(output, list) and output else str(output)
        return {"success": True, "result_url": result_url, "prediction_id": prediction_id, "prompt": prompt}

    except Exception as e:
        error_str = str(e)
        print(f"[ai_service] {model_id} error: {type(e).__name__}: {error_str}")
        if "flagged as sensitive" in error_str or "E005" in error_str:
            return {"success": False, "error": error_str, "content_flagged": True}
        return {"success": False, "error": error_str, "content_flagged": False}


def mock_ai_analysis(item: dict) -> AnalysisResult:
    from .ml_service import score_outfit
    description = item.get("description") or item.get("name") or item.get("category", "clothing item")
    scores = score_outfit([description])
    type_map = {"top": "Upper body", "bottom": "Lower body", "outer": "Outerwear"}
    return AnalysisResult(
        fit_score=scores["fit_score"],
        style_score=scores["style_score"],
        color_harmony=scores["color_harmony"],
        garment_type=type_map.get(item.get("category", "top"), "Unknown"),
        detected_color=item.get("color", ""),
        fabric="",
        recommendation="",
    )
