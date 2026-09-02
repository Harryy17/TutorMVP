"""
Query Analyzer & Intent Routing Agent.
Connects to the LLM to intelligently analyze the user's query, determine true pedagogical intent,
extract target concept keywords for precise RAG context retrieval, and route to appropriate actions.
Prevents question sentences from being mistakenly treated as subject names.
"""
import json
import re
import asyncio
from typing import Dict, Any, List, Optional
from app.rag.ollama_client import ollama

QUERY_ANALYZER_SYSTEM_PROMPT = """You are the Expert Query Analyzer & Intent Routing Agent for IndieTutor, an AI educational platform.
Your task is to analyze the student's message with high linguistic precision and determine:
1. True pedagogical intent
2. The specific target topic/concept to retrieve from the textbook/PDF database
3. Clean search keywords for full-text search (FTS5)
4. Recommended action

CRITICAL RULE:
- If the user asks a question (e.g., "What are the most important concepts in Decision Trees & Random Forests?", "Explain linear regression", "Summarize Chapter 1"), their intent is "EXPLANATION_REQUEST".
- NEVER classify a question sentence as a "NEW_SUBJECT_DECLARATION".
- NEVER output a question sentence as `extracted_subject`. `target_topic` should be the clean concept entity (e.g., "Decision Trees & Random Forests").

INTENT TYPES:
- "EXPLANATION_REQUEST": Asking to explain a concept, find important topics, summarize, compare, or clarify doubts.
- "QUIZ_REQUEST": Asking to be tested, quizzed, or asked practice questions ("quiz me", "test me", "ask 5 questions").
- "QUIZ_ANSWER": Answering a previous quiz question ("A", "Option B", "Hyperplane").
- "STUDY_PLAN_REQUEST": Asking for a study timetable, revision strategy, or roadmap.
- "NEW_SUBJECT_DECLARATION": Explicitly starting or switching to a new course/subject (e.g., "I want to study Chemistry", "Let's learn Physics").
- "GREETING": Simple pleasantries ("Hi", "Hello", "Hey").

JSON OUTPUT FORMAT:
{
  "intent": "EXPLANATION_REQUEST" | "QUIZ_REQUEST" | "QUIZ_ANSWER" | "STUDY_PLAN_REQUEST" | "NEW_SUBJECT_DECLARATION" | "GREETING",
  "target_topic": "Clean topic/entity name or null",
  "search_queries": ["query 1", "query 2"],
  "extracted_subject": "Clean broad subject name if declaring new subject, else null",
  "recommended_action": "EXPLAIN" | "QUIZ_QUESTION" | "EVALUATE_ANSWER" | "GENERATE_PLAN" | "SET_SUBJECT" | "GREET"
}
"""

class QueryAnalyzerAgent:
    """Intelligent Query Analyzer Agent connected to LLM."""

    def __init__(self):
        pass

    async def analyze(
        self,
        message: str,
        current_subject: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Analyzes student query with LLM and returns structured intent & search parameters."""
        raw_msg = message.strip()
        lower = raw_msg.lower()

        # Fast heuristics for obvious greetings
        is_pure_greeting = bool(re.fullmatch(r"(hi|hello|hey|good morning|good evening|hey there|greetings)[.!]?", lower))
        if is_pure_greeting:
            return {
                "intent": "GREETING",
                "target_topic": None,
                "search_queries": [],
                "extracted_subject": None,
                "recommended_action": "GREET"
            }

        # Build LLM prompt
        messages = [
            {"role": "system", "content": QUERY_ANALYZER_SYSTEM_PROMPT}
        ]

        if current_subject:
            messages.append({"role": "system", "content": f"Current Active Subject: {current_subject}"})

        if history:
            recent = history[-4:]
            messages.append({"role": "system", "content": f"Recent Conversation Context: {json.dumps(recent)}"})

        messages.append({"role": "user", "content": f"Analyze this student query: \"{raw_msg}\""})

        try:
            raw_response = await ollama.chat(messages, temperature=0.1)
            cleaned = raw_response.strip()

            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("\n", 1)[0]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()

            if "{" in cleaned and "}" in cleaned:
                start = cleaned.find("{")
                end = cleaned.rfind("}")
                data = json.loads(cleaned[start:end+1], strict=False)

                # Ensure clean target_topic and prevent question sentences as subject
                target_topic = data.get("target_topic")
                if target_topic:
                    target_topic = re.sub(r"^(what is|what are|explain|describe|tell me about)\s+", "", target_topic, flags=re.IGNORECASE).strip()
                    target_topic = target_topic.rstrip("?.,!")

                # Ensure search queries include target topic and key terms
                search_queries = data.get("search_queries") or []
                if target_topic and target_topic not in search_queries:
                    search_queries.insert(0, target_topic)
                if raw_msg not in search_queries:
                    search_queries.append(raw_msg)

                return {
                    "intent": data.get("intent", "EXPLANATION_REQUEST"),
                    "target_topic": target_topic,
                    "search_queries": search_queries,
                    "extracted_subject": data.get("extracted_subject") if data.get("intent") == "NEW_SUBJECT_DECLARATION" else None,
                    "recommended_action": data.get("recommended_action", "EXPLAIN"),
                }
        except Exception as e:
            print(f"[QueryAnalyzerAgent] LLM analysis fallback: {e}")

        # Robust Fallback Logic
        is_question = bool(re.search(r"\b(what|how|why|when|where|which|explain|describe|difference|types|summarize|important|concepts)\b|\?", lower))
        is_quiz = bool(re.search(r"\b(quiz|test me|ask me|practice questions)\b", lower))

        if is_quiz:
            return {
                "intent": "QUIZ_REQUEST",
                "target_topic": current_subject,
                "search_queries": [current_subject or "important concepts"],
                "extracted_subject": None,
                "recommended_action": "QUIZ_QUESTION",
            }
        elif is_question:
            clean_topic = re.sub(r"^(what are the most important concepts in|what is|what are|explain|tell me about)\s+", "", lower, flags=re.IGNORECASE).strip()
            clean_topic = clean_topic.rstrip("?.,!").title()
            return {
                "intent": "EXPLANATION_REQUEST",
                "target_topic": clean_topic if len(clean_topic) > 2 else current_subject,
                "search_queries": [clean_topic, raw_msg],
                "extracted_subject": None,
                "recommended_action": "EXPLAIN",
            }
        else:
            subj_title = raw_msg.title()
            return {
                "intent": "NEW_SUBJECT_DECLARATION",
                "target_topic": subj_title,
                "search_queries": [subj_title],
                "extracted_subject": subj_title,
                "recommended_action": "SET_SUBJECT",
            }

# Singleton instance
query_analyzer = QueryAnalyzerAgent()
