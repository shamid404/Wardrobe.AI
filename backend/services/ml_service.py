"""Local ML models: BLIP (description generation) + Compatibility MLP (outfit scoring)."""
import io
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image

BASE = Path(__file__).parent.parent / "ml_models"
BLIP_PATH = BASE / "blip-fashion"
MLP_PATH = BASE / "compatibility_mlp" / "mlp.pt"

device = "cuda" if torch.cuda.is_available() else "cpu"

# ─── BLIP ────────────────────────────────────────────────────────────────────
_blip_model = None
_blip_processor = None


def _load_blip():
    global _blip_model, _blip_processor
    if _blip_model is None:
        if not BLIP_PATH.exists():
            raise FileNotFoundError(f"BLIP model not found at {BLIP_PATH}")
        from transformers import BlipForConditionalGeneration, BlipProcessor
        _blip_processor = BlipProcessor.from_pretrained(str(BLIP_PATH))
        _blip_model = BlipForConditionalGeneration.from_pretrained(str(BLIP_PATH)).to(device)
        _blip_model.eval()


def generate_description(image_bytes: bytes) -> str:
    """Generate clothing description from image bytes. Returns '' on failure."""
    try:
        _load_blip()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = _blip_processor(images=image, return_tensors="pt").to(device)
        with torch.no_grad():
            output = _blip_model.generate(**inputs, max_new_tokens=50)
        result = _blip_processor.decode(output[0], skip_special_tokens=True)
        print(f"[BLIP] ✅ description: {result}")
        return result
    except Exception as e:
        print(f"[BLIP] ❌ error: {e}")
        return ""


# ─── Compatibility MLP ───────────────────────────────────────────────────────
class _CompatibilityMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(1024, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 64), nn.ReLU(),
            nn.Linear(64, 1), nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x).squeeze()


_clip_model = None
_clip_tokenizer = None
_mlp_model = None


def _load_compatibility():
    global _clip_model, _clip_tokenizer, _mlp_model
    if _mlp_model is None:
        if not MLP_PATH.exists():
            raise FileNotFoundError(f"MLP model not found at {MLP_PATH}")
        import open_clip
        _clip_model, _, _ = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
        _clip_tokenizer = open_clip.get_tokenizer("ViT-B-32")
        _clip_model = _clip_model.to(device)
        _clip_model.eval()

        _mlp_model = _CompatibilityMLP().to(device)
        _mlp_model.load_state_dict(torch.load(str(MLP_PATH), map_location=device))
        _mlp_model.eval()


def score_outfit(item_descriptions: list) -> dict:
    """Score outfit compatibility from item text descriptions.

    Returns {'fit_score', 'style_score', 'color_harmony'} as 0-100 ints.
    Falls back to neutral 75s on any error.
    """
    if len(item_descriptions) < 2:
        return {"fit_score": 75, "style_score": 75, "color_harmony": 75}
    try:
        _load_compatibility()
        tokens = _clip_tokenizer(item_descriptions).to(device)
        with torch.no_grad():
            embeds = _clip_model.encode_text(tokens)
            embeds = embeds / embeds.norm(dim=-1, keepdim=True)

        scores = []
        for i in range(len(embeds)):
            for j in range(i + 1, len(embeds)):
                pair = torch.cat([embeds[i], embeds[j]]).unsqueeze(0)
                scores.append(_mlp_model(pair).item())

        avg = sum(scores) / len(scores)
        base = int(avg * 100)
        return {
            "fit_score": min(100, base + 3),
            "style_score": base,
            "color_harmony": max(0, base - 3),
        }
    except Exception as e:
        print(f"[ml_service] MLP error: {e}")
        return {"fit_score": 75, "style_score": 75, "color_harmony": 75}
