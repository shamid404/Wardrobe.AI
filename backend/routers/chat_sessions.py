import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db.database import get_db
from ..db.models import ChatSession, ChatMessage, WardrobeItem

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    recommended_items: List[dict] = []
    created_at: str


class SessionOut(BaseModel):
    id: str
    title: str
    created_at: str


@router.get("/sessions", response_model=List[SessionOut])
def get_sessions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user["id"])
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return [SessionOut(id=s.id, title=s.title, created_at=s.created_at.strftime("%Y-%m-%d %H:%M")) for s in sessions]


@router.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
def get_session_messages(session_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == user["id"],
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Build lookup for wardrobe items
    wardrobe = {i.id: i for i in db.query(WardrobeItem).filter(WardrobeItem.user_id == user["id"]).all()}

    result = []
    for msg in session.messages:
        rec_items = []
        if msg.recommended_item_ids:
            try:
                ids = json.loads(msg.recommended_item_ids)
                for iid in ids:
                    item = wardrobe.get(iid)
                    if item:
                        rec_items.append({
                            "id": item.id,
                            "name": item.name,
                            "category": item.category,
                            "photo": item.image_url,
                            "removedBg": item.image_url,
                            "brand": item.brand or "",
                            "size": item.size or "",
                        })
            except Exception:
                pass
        result.append(MessageOut(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            recommended_items=rec_items,
            created_at=msg.created_at.strftime("%H:%M"),
        ))
    return result


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.user_id == user["id"],
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
