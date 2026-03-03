"""
Assistant service for handling conversations with OpenAI.
"""
import json
import logging
from typing import Any, Optional

from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, or_

from app.core.config import settings
from app.core.errors import ApiError
from app.assistant.prompt import SYSTEM_PROMPT
from app.assistant.tools import TOOLS_SCHEMA, execute_tool, execute_search_jobs
from app.models.user import User
from app.models.job import Job
from app.models.job_favorite import JobFavorite
from app.api.routes.jobs import _get_resume_keywords_for_user
from app.core.time import to_iso_z

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def looks_like_quick_search(text: str) -> bool:
    """
    Conservative function to determine if input looks like a quick search query.
    Returns True if it should use DIRECT_SEARCH (skip OpenAI, query DB directly).
    
    Rules (in order of priority):
    1. If contains chat intent words -> return False (force LLM_CHAT)
    2. If contains ? or ？ -> return False (force LLM_CHAT)
    3. Only return True if:
       A) Contains explicit search verbs (precise, not generic)
       B) OR is a keyword phrase (short, no punctuation, no question words)
    """
    if not text or not text.strip():
        return False
    
    text_lower = text.strip().lower()
    text_len = len(text_lower)
    
    # Rule 1: Chat intent words blacklist - if contains any, must return False
    chat_intent_words = [
        "怎么", "如何", "为什么", "建议", "准备", "面试", "简历", "职业", "规划",
        "适合", "优势", "缺点", "怎么办", "可不可以", "能不能", "该不该",
        "选择", "对比", "喜欢", "兴趣", "爱好", "为什么", 
        "help me", "how to", "what should", "should I", "can you", "could you",
        "advice", "tips", "guide", "prepare", "prepare for"
    ]
    has_chat_intent = any(word in text_lower for word in chat_intent_words)
    if has_chat_intent:
        return False
    
    # Rule 2: If contains question mark, must return False
    is_question = "?" in text_lower or "？" in text_lower
    if is_question:
        return False
    
    # Rule 3A: Explicit search verbs (precise, not generic like "推荐" or "查")
    explicit_search_verbs = [
        "找工作", "找岗位", "搜岗位", "搜索岗位", "推荐岗位", "推荐工作",
        "search jobs", "find jobs", "look for jobs", "looking for jobs"
    ]
    has_explicit_search_verb = any(verb in text_lower for verb in explicit_search_verbs)
    if has_explicit_search_verb:
        return True
    
    # Rule 3B: Keyword phrase conditions (very strict)
    # - Length <= 30 (to accommodate longer English phrases like "software engineer singapore")
    # - No Chinese question/emotion words (吗/呢/啊/呀)
    # - No punctuation (period/comma/exclamation)
    # - Word count <= 6
    chinese_question_words = ["吗", "呢", "啊", "呀"]
    has_chinese_question_word = any(word in text_lower for word in chinese_question_words)
    
    punctuation = [".", ",", "!", "。", "，", "！"]
    has_punctuation = any(p in text_lower for p in punctuation)
    
    word_count = len(text_lower.split())
    
    if (text_len <= 30 and 
        not has_chinese_question_word and 
        not has_punctuation and 
        word_count <= 6):
        return True
    
    return False


def chat_with_assistant(
    db: Session,
    user_id: str,
    message: str,
    conversation_id: Optional[str] = None,
    context: Optional[dict] = None,
) -> dict[str, Any]:
    """
    Main conversation handler.
    Returns: {
        "conversationId": str,
        "assistantText": str,
        "uiActions": list[dict],
        "debug": dict (optional)
    }
    """
    if not settings.OPENAI_API_KEY:
        raise ApiError(status_code=500, code="CONFIG_ERROR", message="OpenAI API key not configured")
    
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    # Load conversation history
    from app.models.assistant_conversation import AssistantConversation, AssistantMessage
    
    from sqlalchemy import select
    
    if conversation_id:
        conv = db.scalar(
            select(AssistantConversation).where(
                AssistantConversation.id == conversation_id,
                AssistantConversation.user_id == user_id
            )
        )
        if not conv:
            raise ApiError(status_code=404, code="NOT_FOUND", message="Conversation not found")
    else:
        # Create new conversation
        conv = AssistantConversation(user_id=user_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conversation_id = conv.id
    
    # Load messages
    messages_db = db.scalars(
        select(AssistantMessage)
        .where(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.created_at)
    ).all()
    
    # Get user's resume information for context
    user = db.scalar(select(User).where(User.id == user_id))
    resume_id = user.default_resume_id if user else None
    resume_keywords = _get_resume_keywords_for_user(db, user_id=user_id, resume_id=resume_id)
    
    # Check if this is a quick search (DIRECT_SEARCH mode)
    is_quick_search = looks_like_quick_search(message)
    mode = "DIRECT_SEARCH" if is_quick_search else "LLM_CHAT"
    logger.info(f"[Assistant] Mode: {mode}, quick_search: {is_quick_search}, Message: {message[:100]}")
    
    # DIRECT_SEARCH: Skip OpenAI, query DB directly
    if is_quick_search:
        try:
            # Use execute_search_jobs to get results
            search_result = execute_search_jobs(
                db=db,
                user_id=user_id,
                query_text=message,
                filters={},
                limit=50,
                offset=0,
                sort_by="match"
            )
            
            # Build response
            jobs = search_result.get("jobs", [])
            total = search_result.get("total", 0)
            
            if total == 0:
                assistant_text = "我没有在数据库中找到匹配岗位。你可以换关键词/地点，或告诉我你想要的方向我来帮你推荐。"
            else:
                assistant_text = f"我找到了 {total} 个匹配的岗位。请查看右侧的搜索结果。"
            
            # Build UI actions
            ui_actions = [
                {
                    "type": "SET_SEARCH_QUERY",
                    "payload": {
                        "queryText": message,
                        "filters": {}
                    }
                },
                {
                    "type": "SET_SEARCH_RESULTS",
                    "payload": {
                        "jobs": jobs,
                        "total": total
                    }
                }
            ]
            
            # Save user message
            user_msg = AssistantMessage(
                conversation_id=conversation_id,
                role="user",
                content=message
            )
            db.add(user_msg)
            
            # Save assistant message
            assistant_msg = AssistantMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=assistant_text
            )
            db.add(assistant_msg)
            db.commit()
            
            return {
                "conversationId": conversation_id,
                "assistantText": assistant_text,
                "uiActions": ui_actions,
                "debug": {"mode": mode}
            }
        except Exception as e:
            logger.error(f"[Assistant] DIRECT_SEARCH error: {e}", exc_info=True)
            # Fall through to LLM_CHAT on error
            mode = "LLM_CHAT"
            is_quick_search = False
    
    # LLM_CHAT: Use OpenAI with tools always available
    # Build enhanced context
    enhanced_context = context.copy() if context else {}
    
    if resume_keywords:
        enhanced_context["resume"] = {
            "hasResume": True,
            "keywords": resume_keywords,
            "skills": resume_keywords.get("skills", []),
            "tools": resume_keywords.get("tools", []),
            "domain": resume_keywords.get("domain", []),
            "titles": resume_keywords.get("titles", []),
        }
    else:
        enhanced_context["resume"] = {"hasResume": False}
    
    # Build messages for OpenAI
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add enhanced context
    context_parts = []
    if enhanced_context.get("resume", {}).get("hasResume"):
        resume_info = enhanced_context["resume"]
        context_parts.append("User has uploaded a resume with the following skills and experience:")
        if resume_info.get("skills"):
            context_parts.append(f"- Skills: {', '.join(resume_info['skills'][:10])}")
        if resume_info.get("tools"):
            context_parts.append(f"- Tools/Technologies: {', '.join(resume_info['tools'][:10])}")
        if resume_info.get("domain"):
            context_parts.append(f"- Domain Experience: {', '.join(resume_info['domain'][:10])}")
        if resume_info.get("titles"):
            context_parts.append(f"- Previous Roles: {', '.join(resume_info['titles'][:5])}")
        context_parts.append("When recommending jobs, prioritize matches with these skills and experience.")
    else:
        context_parts.append("User has not uploaded a resume yet. You can still help them find jobs based on their preferences and interests.")
    
    if enhanced_context.get("searchState"):
        context_parts.append(f"Current search state: {json.dumps(enhanced_context['searchState'], ensure_ascii=False)}")
    
    if context_parts:
        context_str = "\n".join(context_parts)
        messages.append({"role": "system", "content": context_str})
    
    # Add conversation history
    for msg in messages_db:
        if msg.role == "assistant" and msg.tool_calls_json:
            # Assistant message with tool calls
            try:
                tool_calls = json.loads(msg.tool_calls_json)
                messages.append({
                    "role": "assistant",
                    "content": msg.content,
                    "tool_calls": tool_calls
                })
                # Add tool results if available
                if msg.tool_results_json:
                    try:
                        tool_results = json.loads(msg.tool_results_json)
                        messages.extend(tool_results)
                    except Exception:
                        pass
            except Exception:
                messages.append({"role": msg.role, "content": msg.content})
        else:
            messages.append({"role": msg.role, "content": msg.content})
    
    # Add user message
    messages.append({"role": "user", "content": message})
    
    # Save user message
    user_msg = AssistantMessage(
        conversation_id=conversation_id,
        role="user",
        content=message
    )
    db.add(user_msg)
    db.commit()
    
    # Call OpenAI with tool calling
    tool_calls_executed = []
    tool_results_for_db = []
    max_iterations = 3  # Prevent infinite loops
    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        
        # LLM_CHAT: Always provide tools, let OpenAI decide when to use them
        logger.debug(f"[Assistant] LLM_CHAT iteration {iteration}, calling OpenAI with tools")
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            tools=TOOLS_SCHEMA,
            tool_choice="auto",  # Let OpenAI decide when to use tools
            temperature=0.8,  # Slightly higher for more varied, personalized responses
        )
        
        assistant_message = response.choices[0].message
        
        # Check if model wants to call tools
        if assistant_message.tool_calls:
            # Execute tools
            tool_results = []
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except Exception as e:
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": tool_name,
                        "content": json.dumps({"error": f"Invalid arguments: {str(e)}"})
                    })
                    continue
                
                try:
                    result = execute_tool(tool_name, arguments, db, user_id)
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": tool_name,
                        "content": json.dumps(result, ensure_ascii=False)
                    })
                    tool_calls_executed.append({
                        "name": tool_name,
                        "arguments": arguments,
                        "result": result
                    })
                except Exception as e:
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": tool_name,
                        "content": json.dumps({"error": str(e)})
                    })
            
            # Add tool calls and results to messages
            messages.append({
                "role": "assistant",
                "content": assistant_message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })
            messages.extend(tool_results)
            tool_results_for_db = tool_results
            
            # Continue loop to get final response
            continue
        else:
            # Final response
            assistant_text = assistant_message.content or ""
            
            # Parse UI actions from response (try to extract JSON from response)
            ui_actions = []
            try:
                # Try to find JSON in response (look for ```json blocks or structured text)
                if "```json" in assistant_text:
                    json_start = assistant_text.find("```json") + 7
                    json_end = assistant_text.find("```", json_start)
                    if json_end > json_start:
                        json_str = assistant_text[json_start:json_end].strip()
                        parsed = json.loads(json_str)
                        if isinstance(parsed, dict) and "uiActions" in parsed:
                            ui_actions = parsed["uiActions"]
                            # Remove JSON block from text
                            assistant_text = assistant_text[:json_start-7] + assistant_text[json_end+3:].strip()
                elif "uiActions" in assistant_text:
                    # Try to extract JSON object
                    start_idx = assistant_text.find("{")
                    end_idx = assistant_text.rfind("}") + 1
                    if start_idx >= 0 and end_idx > start_idx:
                        try:
                            parsed = json.loads(assistant_text[start_idx:end_idx])
                            if "uiActions" in parsed:
                                ui_actions = parsed["uiActions"]
                                assistant_text = assistant_text[:start_idx].strip()
                        except Exception:
                            pass
            except Exception:
                pass
            
            # Generate UI actions from tool calls if not found in text
            if not ui_actions and tool_calls_executed:
                for tc in tool_calls_executed:
                    if tc["name"] == "search_jobs":
                        ui_actions.append({
                            "type": "SET_SEARCH_RESULTS",
                            "payload": {
                                "jobs": tc["result"].get("jobs", []),
                                "total": tc["result"].get("total", 0)
                            }
                        })
                        ui_actions.append({
                            "type": "SET_SEARCH_QUERY",
                            "payload": {
                                "queryText": tc["arguments"].get("queryText", ""),
                                "filters": tc["arguments"].get("filters", {})
                            }
                        })
                    elif tc["name"] == "get_job_detail":
                        ui_actions.append({
                            "type": "HIGHLIGHT_JOB",
                            "payload": {
                                "jobId": tc["arguments"]["jobId"]
                            }
                        })
                    elif tc["name"] == "create_application":
                        ui_actions.append({
                            "type": "SHOW_TOAST",
                            "payload": {
                                "message": f"Application created for {tc['result'].get('snapshotCompany', 'job')}",
                                "level": "success"
                            }
                        })
            
            # Save assistant message
            tool_calls_for_db = []
            if assistant_message.tool_calls:
                for tc in assistant_message.tool_calls:
                    tool_calls_for_db.append({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    })
            
            assistant_msg = AssistantMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=assistant_text,
                tool_calls_json=json.dumps(tool_calls_for_db) if tool_calls_for_db else None,
                tool_results_json=json.dumps(tool_results_for_db) if tool_calls_executed and tool_results_for_db else None
            )
            db.add(assistant_msg)
            db.commit()
            
            # Log LLM_CHAT results
            tool_calls_count = len(tool_calls_executed) if tool_calls_executed else 0
            assistant_text_len = len(assistant_text) if assistant_text else 0
            logger.info(
                f"[Assistant] LLM_CHAT completed - "
                f"mode: {mode}, quick_search: {is_quick_search}, "
                f"message: {message[:50]}, "
                f"assistantText_len: {assistant_text_len}, "
                f"tool_calls_count: {tool_calls_count}"
            )
            
            return {
                "conversationId": conversation_id,
                "assistantText": assistant_text,
                "uiActions": ui_actions,
                "debug": {
                    "mode": mode,
                    "toolCalls": tool_calls_executed
                } if tool_calls_executed else {"mode": mode}
            }
    
    # If we exit loop without final response, return error
    raise ApiError(status_code=500, code="ASSISTANT_ERROR", message="Assistant did not return final response")
