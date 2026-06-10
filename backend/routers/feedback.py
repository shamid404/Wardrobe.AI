import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import OutfitFeedback

router = APIRouter(tags=["feedback"])


class FeedbackRequest(BaseModel):
    item_names: List[str]
    score: int              # +1 or -1
    reason: Optional[str] = None  # "combination" | "season" | "item" | None
    session_id: Optional[str] = None


@router.post("/assistant/feedback", status_code=201)
def submit_feedback(
    req: FeedbackRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import json
    fb = OutfitFeedback(
        id=f"fb_{uuid.uuid4().hex[:8]}",
        user_id=user["id"],
        item_ids=json.dumps(req.item_names),
        score=req.score,
        reason=req.reason,
        session_id=req.session_id,
    )
    db.add(fb)
    db.commit()
    return {"ok": True}


def get_feedback_context(user_id: str, db: Session, limit: int = 10) -> str:
    """Build a feedback summary string to inject into Gemini prompt."""
    import json
    feedbacks = (
        db.query(OutfitFeedback)
        .filter(OutfitFeedback.user_id == user_id)
        .order_by(OutfitFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
    if not feedbacks:
        return ""

    liked, disliked = [], []
    for fb in feedbacks:
        try:
            names = json.loads(fb.item_ids)
        except Exception:
            continue
        combo = ", ".join(names)
        if fb.score > 0:
            liked.append(f"  - {combo}")
        else:
            reason_txt = f" (reason: {fb.reason})" if fb.reason else ""
            disliked.append(f"  - {combo}{reason_txt}")

    lines = []
    if liked:
        lines.append("Outfits the user liked before:\n" + "\n".join(liked))
    if disliked:
        lines.append("Outfits the user disliked before:\n" + "\n".join(disliked))

    return "\n\n".join(lines)
