"""Shared Gemini caller with model fallback and robust JSON handling.

Centralises the call so both the chat assistant and the week planner share
the same fallback chain and the same protection against truncated JSON
(which previously leaked raw, half-finished JSON into the chat UI).
"""
import json
import re
from typing import Optional, Tuple

import requests

from ..config import GEMINI_API_KEY

MODELS = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]


def recover_message(raw: str) -> str:
    """Best-effort extraction of the "message" field from broken/truncated JSON.

    When the model output is cut off by maxOutputTokens the JSON fails to parse.
    Instead of showing the user raw braces, pull out whatever text we can.
    """
    if not raw:
        return ""
    m = re.search(r'"message"\s*:\s*"((?:[^"\\]|\\.)*)', raw)
    if m:
        fragment = m.group(1)
        try:
            return json.loads('"' + fragment + '"')
        except Exception:
            # Unescape the common sequences manually if the fragment is partial.
            return fragment.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
    return ""


def call_gemini_json(
    contents: list,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> Tuple[Optional[dict], str]:
    """Call Gemini expecting a JSON object response.

    Returns (parsed_dict_or_None, raw_text). Walks the model fallback chain,
    skipping rate-limited (429) / overloaded (503) models.
    """
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }

    last_raw = ""
    for model in MODELS:
        try:
            r = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                json=payload,
                headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"},
                timeout=40,
            )
            if r.status_code in (429, 503):
                continue
            r.raise_for_status()
            raw = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            try:
                return json.loads(raw), raw
            except json.JSONDecodeError:
                # Bad/truncated JSON from this model — keep it as a fallback and
                # try the next model before giving up.
                last_raw = raw
                continue
        except Exception:
            continue

    return None, last_raw
