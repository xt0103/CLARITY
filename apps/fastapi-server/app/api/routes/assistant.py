"""
Assistant API routes.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import db_session, get_current_user_id
from app.core.errors import ApiError
from app.assistant.service import chat_with_assistant
from sqlalchemy.orm import Session


router = APIRouter(tags=["assistant"])


class ChatRequest(BaseModel):
    message: str
    conversationId: Optional[str] = None
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    conversationId: str
    assistantText: str
    uiActions: list[dict] = []
    debug: Optional[dict] = None


@router.post("/api/assistant/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(db_session),
) -> ChatResponse:
    """
    Chat with AI assistant.
    """
    if not payload.message or not payload.message.strip():
        raise ApiError(status_code=400, code="VALIDATION_ERROR", message="Message is required")
    
    try:
        result = chat_with_assistant(
            db=db,
            user_id=user_id,
            message=payload.message.strip(),
            conversation_id=payload.conversationId,
            context=payload.context,
        )
        return ChatResponse(**result)
    except ApiError:
        raise
    except Exception as e:
        raise ApiError(status_code=500, code="ASSISTANT_ERROR", message=f"Assistant error: {str(e)}")
