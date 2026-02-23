"""
Assistant service for handling conversations with OpenAI.
"""
import json
from typing import Any, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ApiError
from app.assistant.prompt import SYSTEM_PROMPT
from app.assistant.tools import TOOLS_SCHEMA, execute_tool


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
    
    # Build messages for OpenAI
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add context if provided
    if context:
        context_str = f"User context: {json.dumps(context, ensure_ascii=False)}"
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
        
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            tools=TOOLS_SCHEMA,
            tool_choice="auto",
            temperature=0.7,
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
            
            return {
                "conversationId": conversation_id,
                "assistantText": assistant_text,
                "uiActions": ui_actions,
                "debug": {
                    "toolCalls": tool_calls_executed
                } if tool_calls_executed else None
            }
    
    # If we exit loop without final response, return error
    raise ApiError(status_code=500, code="ASSISTANT_ERROR", message="Assistant did not return final response")
