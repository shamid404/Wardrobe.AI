import uuid
import random
from typing import Optional, List

import replicate

from ..config import REPLICATE_API_TOKEN
from ..models.schemas import AnalysisResult

replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN) if REPLICATE_API_TOKEN else None


async def generate_virtual_tryon(
    avatar_url: str,
    outfit_collage_url: Optional[str] = None,
    top_name: Optional[str] = None,
    bottom_name: Optional[str] = None,
    outer_name: Optional[str] = None,
    headwear_name: Optional[str] = None,
    shoes_name: Optional[str] = None,
    accessory_names: Optional[List[str]] = None,
) -> dict:
    """Generate virtual try-on using Replicate flux-2-pro model."""
    try:
        prompt_parts = ["A real person wearing a complete outfit"]

        if top_name:
            prompt_parts.append(f"{top_name} on upper body")
        if outer_name:
            prompt_parts.append(f"{outer_name} as outerwear")
        if bottom_name:
            prompt_parts.append(f"{bottom_name} on lower body")
        if headwear_name:
            prompt_parts.append(f"{headwear_name} as headwear")
        if shoes_name:
            prompt_parts.append(f"{shoes_name} as footwear")
        if accessory_names:
            prompt_parts.append(f"accessorized with {', '.join(accessory_names)}")

        prompt = (
            ", ".join(prompt_parts)
            + ". Reproduce the exact colors, patterns and style of clothes shown in the reference outfit image."
            + " Full body shot, neutral background, photorealistic, high quality fashion photo."
        )

        input_images = [avatar_url]
        if outfit_collage_url:
            input_images.append(outfit_collage_url)

        input_images = input_images[:2]

        if replicate_client is None:
            raise RuntimeError("REPLICATE_API_TOKEN не задан. Укажите переменную окружения REPLICATE_API_TOKEN.")

        output = replicate_client.run(
            "black-forest-labs/flux-2-pro",
            input={
                "prompt": prompt,
                "input_images": input_images,
                "guidance_scale": 7.5,
                "num_inference_steps": 20,
                "aspect_ratio": "1:1",
                "output_format": "jpg",
                "safety_tolerance": 5,
            },
        )

        if isinstance(output, list) and len(output) > 0:
            result_url = output[0]
        else:
            result_url = str(output)

        return {
            "success": True,
            "result_url": result_url,
            "prediction_id": f"flux_{uuid.uuid4().hex[:10]}",
            "prompt": prompt,
        }

    except Exception as e:
        error_str = str(e)
        print(f"[ai_service] generate_virtual_tryon error: {type(e).__name__}: {error_str}")
        if "flagged as sensitive" in error_str or "E005" in error_str:
            return {"success": False, "error": error_str, "content_flagged": True}
        return {"success": False, "error": error_str, "content_flagged": False}


def mock_ai_analysis(item: dict) -> AnalysisResult:
    colors = ["Warm beige", "Deep navy", "Ivory white", "Charcoal grey", "Terracotta"]
    fabrics = ["Cotton blend", "Pure silk", "Linen", "Wool", "Polyester mix"]
    type_map = {"top": "Upper body", "bottom": "Lower body", "outer": "Outerwear"}
    recs = [
        "Great fit for your body type!",
        "Pairs well with neutral tones.",
        "Consider layering with a blazer.",
        "Perfect for casual occasions.",
        "Excellent color harmony detected.",
    ]
    return AnalysisResult(
        fit_score=random.randint(78, 97),
        style_score=random.randint(75, 95),
        color_harmony=random.randint(80, 98),
        garment_type=type_map.get(item.get("category", "top"), "Unknown"),
        detected_color=random.choice(colors),
        fabric=random.choice(fabrics),
        recommendation=random.choice(recs),
    )
