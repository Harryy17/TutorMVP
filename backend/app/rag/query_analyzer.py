"""
Planning Agent — Advanced Query Analysis & Retrieval-Strategy Router.

Architecture
------------
This module is the "planner" half of a two-agent pipeline (planner -> executor,
see decision_agent.py). Its only job is to *think about the question* before
anything is retrieved or answered:

    1. THINK     — classify true pedagogical intent, decompose multi-part
                   questions into sub-questions, decide what kind of source
                   material (text / table / image) is needed, and pick a
                   response format contract (comparison / list / conceptual /
                   diagram / quiz).
    2. SELF-RATE — the LLM reports its own confidence in the classification.
                   Low confidence flags `needs_clarification` instead of
                   silently guessing.
    3. VALIDATE  — every LLM output is parsed defensively, retried once with
                   a stricter prompt on failure, and finally backed by
                   deterministic heuristics so the app never crashes on a
                   malformed model response.

Keeping this as a separate, narrow-purpose LLM call (rather than folding
planning into the final-answer prompt) is what makes the pipeline "agentic":
the planner can be inspected, unit-tested, and iterated on independently of
answer generation.
"""
import json
import re
import asyncio
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
from app.rag.ollama_client import ollama


PLANNER_SYSTEM_PROMPT = """You are the Planning Agent for IndieTutor, an AI educational platform.
You do not answer the student. You THINK ABOUT the question and produce a retrieval + response plan
that a downstream tutoring agent will execute.

Work through this reasoning chain internally before writing JSON:
1. INTENT: What does the student actually want done?
2. DECOMPOSITION: Is this a compound / multi-part question (e.g. "explain X and compare it to Y",
   "what is X and how is it used in Y")? If so, split it into atomic sub-questions that can each be
   answered from a focused retrieval. If it's a single atomic question, sub_questions = [the question itself].
3. RETRIEVAL STRATEGY: What clean full-text search queries will surface the right chunks? Prefer specific
   noun-phrases over the raw sentence. Include one query per sub-question.
4. SOURCE & VISUAL NEEDS (Cognitive Evaluation):
   - Evaluate whether a visual substantially improves pedagogical clarity:
     * `requires_image_data`: true if the question refers to a visual figure, diagram, chart, or slide image in the document, or if answering it strongly benefits from visual document context.
     * `visual_modality`:
       - "document_figure": Student asks to see, locate, or inspect a specific figure, architecture slide, diagram, or chart from the uploaded material.
       - "generate_image": The concept involves workflows, sequential pipelines, architecture, anatomy, or scientific mechanisms that should be visually illustrated using OpenAI Image Generation.
       - "none": A pure text or mathematical explanation is optimal.
     * `suggested_diagram_type`: "schematic" | "infographic" | "architecture" | "concept_illustration" | null.
5. LENGTH & CONSTRAINTS (Cognitive Detection):
   - Evaluate if the student specified a specific length, directness, or brevity constraint:
     * `length_constraint`:
       - "one_word": Student explicitly asked for a single word, exact term, name, or acronym (e.g. "in one word", "single word answer").
       - "one_sentence": Student explicitly asked for 1 sentence (e.g. "in one sentence", "one-line definition").
       - "one_paragraph": Student explicitly asked for a single paragraph (e.g. "in one paragraph", "single paragraph explanation").
       - "concise": Student asked to be brief / short / tl;dr / quick overview without full essays.
       - "comprehensive": Student asked for detailed / in-depth / exhaustive explanation.
       - null: No explicit length restriction stated.
     * `output_style`:
       - "direct_answer_only": Student explicitly demands only the answer without intro hooks, pleasantries, or extra scaffolding (e.g. "answer only", "just the answer", "no fluff", "directly answer").
       - "table": Student explicitly asks for tabular comparison, columns and rows, or matrix (e.g. "in a table", "tabular format", "show as a table").
       - "bullet_summary": Student explicitly asks for bullet points or summary list (e.g. "summary", "bullet points summary", "give me 3 bullets").
       - "diagram": Architecture / workflow / visual diagram requested.
       - "standard": Standard natural pedagogical explanation.
     * `suppress_scaffolding`: true if the student asked for "answer only", "one word", "no pleasantries", "direct answer", or "no quiz/follow-up", instructing the tutor to omit conversational hooks and follow-up questions. Otherwise false.
6. RESPONSE FORMAT: Pick the contract the executor should follow: "comparison" (vs/difference/trade-offs),
   "list" (bullet points / enumerate), "diagram" (architecture/figure/visual explanation), "quiz"
   (test me / ask me questions), "study_plan" (timetable / roadmap), "study_notes" (standalone reference
   document/cheat sheet/notes), or "conceptual" (default explanation).
   - study_notes: student wants a standalone reference document (notes/cheat sheet), not a conversational
     answer. Trigger only on explicit requests ("notes", "cheat sheet", "study map", "summarize as notes") — a
     plain question ("what is X") stays "conceptual" even if the answer could double as notes.
7. CONFIDENCE: Rate 0.0-1.0 how confident you are in this classification. Use < 0.5 only when the message
   is genuinely ambiguous (e.g. a single vague word with no context).

CRITICAL RULES:
- NEVER classify a question sentence (contains what/how/why/explain/compare/difference/? etc.) as
  "NEW_SUBJECT_DECLARATION". Questions are always "EXPLANATION_REQUEST", "STUDY_NOTES_REQUEST", "QUIZ_REQUEST", or "QUIZ_ANSWER".
- `target_topic` and `extracted_subject` must be clean concept/subject noun-phrases, never a full question
  sentence and never prefixed with "what is/explain/tell me about".
- If the student is answering a quiz (a short answer like "A", "Option B", a single term, or a short
  free-text response immediately following a quiz question in conversation context), intent is "QUIZ_ANSWER".

INTENT TYPES:
- "EXPLANATION_REQUEST": explain / find important topics / summarize / compare / clarify doubts.
- "STUDY_NOTES_REQUEST": student explicitly wants structured study notes, a cheat sheet, a revision summary, or a "study map" for a topic — not a single Q&A answer (e.g. "give me study notes on X", "make notes for revision", "create a cheat sheet on X", "summarize this chapter as notes").
- "QUIZ_REQUEST": be tested/quizzed ("quiz me", "test me", "ask 5 questions").
- "QUIZ_ANSWER": answering a previous quiz question.
- "STUDY_PLAN_REQUEST": timetable, revision strategy, roadmap.
- "NEW_SUBJECT_DECLARATION": explicitly starting/switching a course/subject (not a question).
- "GREETING": simple pleasantries.

Respond with ONLY this JSON object, no preamble, no markdown fences:
{
  "reasoning": "1-3 sentence internal reasoning trace covering steps 1-5 above",
  "intent": "EXPLANATION_REQUEST" | "STUDY_NOTES_REQUEST" | "QUIZ_REQUEST" | "QUIZ_ANSWER" | "STUDY_PLAN_REQUEST" | "NEW_SUBJECT_DECLARATION" | "GREETING",
  "sub_questions": ["atomic sub-question 1", "atomic sub-question 2"],
  "target_topic": "Clean topic/entity name or null",
  "search_queries": ["query 1", "query 2"],
  "extracted_subject": "Clean broad subject name if declaring new subject, else null",
  "response_format": "comparison" | "list" | "diagram" | "quiz" | "study_plan" | "study_notes" | "conceptual",
  "length_constraint": "one_word" | "one_sentence" | "one_paragraph" | "concise" | "comprehensive" | null,
  "output_style": "direct_answer_only" | "table" | "bullet_summary" | "diagram" | "standard",
  "suppress_scaffolding": true | false,
  "requires_table_data": true | false,
  "requires_image_data": true | false,
  "visual_modality": "document_figure" | "generate_image" | "none",
  "suggested_diagram_type": "schematic" | "infographic" | "architecture" | "concept_illustration" | null,
  "confidence": 0.0,
  "needs_clarification": true | false,
  "recommended_action": "EXPLAIN" | "QUIZ_QUESTION" | "EVALUATE_ANSWER" | "GENERATE_PLAN" | "SET_SUBJECT" | "GREET"
}
"""

_MAX_RETRIES = 2
_LOW_CONFIDENCE_THRESHOLD = 0.5


@dataclass
class QueryPlan:
    """Structured output of the planning pass. Backward-compatible dict via as_dict()."""
    intent: str = "EXPLANATION_REQUEST"
    reasoning: str = ""
    sub_questions: List[str] = field(default_factory=list)
    target_topic: Optional[str] = None
    search_queries: List[str] = field(default_factory=list)
    extracted_subject: Optional[str] = None
    response_format: str = "conceptual"
    length_constraint: Optional[str] = None
    output_style: str = "standard"
    suppress_scaffolding: bool = False
    requires_table_data: bool = False
    requires_image_data: bool = False
    visual_modality: str = "none"
    suggested_diagram_type: Optional[str] = None
    confidence: float = 0.7
    needs_clarification: bool = False
    recommended_action: str = "EXPLAIN"

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned.strip()


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    cleaned = _strip_code_fences(text)
    if "{" not in cleaned or "}" not in cleaned:
        return None
    start, end = cleaned.find("{"), cleaned.rfind("}")
    try:
        return json.loads(cleaned[start:end + 1], strict=False)
    except Exception:
        return None


def _clean_topic_string(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    value = re.sub(
        r"^(what is|what are|explain|describe|tell me about|compare)\s+",
        "", value.strip(), flags=re.IGNORECASE,
    ).strip()
    value = value.rstrip("?.,!").strip()
    return value or None


class QueryAnalyzerAgent:
    """Agentic planner: thinks about a student query before any retrieval or generation happens."""

    def __init__(self, max_retries: int = _MAX_RETRIES):
        self.max_retries = max_retries

    async def analyze(
        self,
        message: str,
        current_subject: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Runs the planning pass and returns a plan dict (superset of the legacy schema)."""
        raw_msg = message.strip()
        lower = raw_msg.lower()

        # Fast-path heuristic: no need to spend an LLM call on a bare greeting.
        if re.fullmatch(r"(hi|hello|hey|good morning|good evening|hey there|greetings)[.!]?", lower):
            return QueryPlan(
                intent="GREETING",
                reasoning="Message is a bare greeting with no topical content.",
                confidence=0.95,
                recommended_action="GREET",
            ).as_dict()

        # High-Speed Fast-Path Heuristic: Standard questions, comparisons, quizzes, notes, or topics
        # evaluate in sub-millisecond time, cutting 4-8s of unnecessary LLM roundtrips!
        is_obvious_intent = (
            len(raw_msg.split()) < 35
            or any(lower.startswith(w) for w in ["what", "how", "why", "when", "where", "which", "explain", "describe", "compare", "difference", "list", "summarize", "define", "give me", "make", "create", "quiz", "test", "show", "can you"])
            or "?" in raw_msg
        )
        if is_obvious_intent:
            heuristic = self._heuristic_plan(raw_msg, current_subject)
            heuristic.confidence = 0.90
            return heuristic.as_dict()

        plan = await self._plan_with_retries(raw_msg, current_subject, history)
        return plan.as_dict()

    async def _plan_with_retries(
        self,
        raw_msg: str,
        current_subject: Optional[str],
        history: Optional[List[Dict[str, str]]],
    ) -> QueryPlan:
        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                data = await self._call_planner_llm(raw_msg, current_subject, history, strict=attempt > 0)
                if data:
                    return self._parse_plan(data, raw_msg)
            except Exception as e:  # noqa: BLE001 - we deliberately degrade, never crash
                last_error = e
                print(f"[QueryAnalyzerAgent] planning attempt {attempt} failed: {e}")
            if attempt < self.max_retries:
                await asyncio.sleep(0.4 * (attempt + 1))

        if last_error:
            print(f"[QueryAnalyzerAgent] all planning attempts exhausted, using heuristic fallback: {last_error}")
        return self._heuristic_plan(raw_msg, current_subject)

    async def _call_planner_llm(
        self,
        raw_msg: str,
        current_subject: Optional[str],
        history: Optional[List[Dict[str, str]]],
        strict: bool,
    ) -> Optional[Dict[str, Any]]:
        messages = [{"role": "system", "content": PLANNER_SYSTEM_PROMPT}]

        if strict:
            messages.append({
                "role": "system",
                "content": "Your previous response was not valid JSON or was incomplete. "
                            "Respond with ONLY the raw JSON object described above — no prose, no fences.",
            })

        if current_subject:
            messages.append({"role": "system", "content": f"Current Active Subject: {current_subject}"})

        if history:
            messages.append({
                "role": "system",
                "content": f"Recent Conversation Context: {json.dumps(history[-4:])}",
            })

        messages.append({"role": "user", "content": f'Analyze this student query: "{raw_msg}"'})

        temperature = 0.1 if not strict else 0.0
        raw_response = await ollama.chat(messages, temperature=temperature)
        return _extract_json(raw_response)

    def _parse_plan(self, data: Dict[str, Any], raw_msg: str) -> QueryPlan:
        intent = data.get("intent") or "EXPLANATION_REQUEST"

        # Guardrail: a question sentence is never a subject declaration, regardless of what the LLM said.
        is_question = bool(re.search(
            r"\b(what|how|why|when|where|which|explain|describe|difference|types|"
            r"summarize|important|concepts|compare)\b|\?",
            raw_msg.lower(),
        ))
        if is_question and intent == "NEW_SUBJECT_DECLARATION":
            intent = "EXPLANATION_REQUEST"

        target_topic = _clean_topic_string(data.get("target_topic"))
        extracted_subject = (
            _clean_topic_string(data.get("extracted_subject"))
            if intent == "NEW_SUBJECT_DECLARATION" and not is_question else None
        )

        sub_questions = data.get("sub_questions") or []
        if not isinstance(sub_questions, list) or not sub_questions:
            sub_questions = [raw_msg]

        search_queries = data.get("search_queries") or []
        if not isinstance(search_queries, list):
            search_queries = []
        if target_topic and target_topic not in search_queries:
            search_queries.insert(0, target_topic)
        for sq in sub_questions:
            if sq not in search_queries:
                search_queries.append(sq)
        if raw_msg not in search_queries:
            search_queries.append(raw_msg)

        try:
            confidence = float(data.get("confidence", 0.7))
        except (TypeError, ValueError):
            confidence = 0.7
        confidence = max(0.0, min(1.0, confidence))

        needs_clarification = bool(data.get("needs_clarification", False)) or confidence < _LOW_CONFIDENCE_THRESHOLD

        visual_modality = str(data.get("visual_modality") or "none").strip().lower()
        if visual_modality in ["generative_diagram", "generate_image"]:
            visual_modality = "generate_image"
        elif visual_modality not in ["document_figure", "generate_image", "none"]:
            visual_modality = "generate_image" if bool(data.get("requires_image_data")) else "none"

        suggested_diagram_type = data.get("suggested_diagram_type")

        # Cognitive constraint parsing
        raw_len = data.get("length_constraint")
        length_constraint = None
        if raw_len:
            clean_len = str(raw_len).strip().lower()
            if clean_len in ["one_word", "one_sentence", "one_paragraph", "concise", "comprehensive"]:
                length_constraint = clean_len

        raw_style = str(data.get("output_style") or "standard").strip().lower()
        if raw_style in ["direct_answer_only", "table", "bullet_summary", "diagram", "standard"]:
            output_style = raw_style
        else:
            output_style = "standard"

        suppress_scaffolding = bool(data.get("suppress_scaffolding", False))
        if length_constraint in ["one_word", "one_sentence"] or output_style == "direct_answer_only":
            suppress_scaffolding = True

        return QueryPlan(
            intent=intent,
            reasoning=str(data.get("reasoning", "")).strip(),
            sub_questions=sub_questions,
            target_topic=target_topic if not is_question or intent != "NEW_SUBJECT_DECLARATION" else target_topic,
            search_queries=search_queries,
            extracted_subject=extracted_subject,
            response_format=data.get("response_format") or "conceptual",
            length_constraint=length_constraint,
            output_style=output_style,
            suppress_scaffolding=suppress_scaffolding,
            requires_table_data=bool(data.get("requires_table_data", False)) or output_style == "table",
            requires_image_data=bool(data.get("requires_image_data", False)) or visual_modality != "none",
            visual_modality=visual_modality,
            suggested_diagram_type=suggested_diagram_type,
            confidence=confidence,
            needs_clarification=needs_clarification,
            recommended_action=data.get("recommended_action") or "EXPLAIN",
        )

    def _heuristic_plan(self, raw_msg: str, current_subject: Optional[str]) -> QueryPlan:
        """Deterministic fallback used only if the LLM is unreachable after all retries."""
        lower = raw_msg.lower()
        is_study_notes = bool(re.search(
            r"\b(study notes?|cheat sheet|revision notes?|study map|summari[sz]e.*as notes)\b", lower
        ))
        is_diagram = bool(re.search(r"\b(diagram|architecture|figure|visual|image|flowchart|schematic|workflow)\b", lower))
        is_question = is_diagram or bool(re.search(
            r"\b(what|how|why|when|where|which|explain|describe|difference|types|"
            r"summarize|important|concepts|compare|show|draw|visualize|illustrate|step by step)\b|\?",
            lower,
        ))
        is_quiz = bool(re.search(r"\b(quiz|test me|ask me|practice questions)\b", lower))
        is_comparison = bool(re.search(r"\b(vs|versus|compare|difference|trade-?offs?)\b", lower))

        # Heuristic length & style detection
        length_constraint = None
        if bool(re.search(r"\b(one word|single word|just the word|word only)\b", lower)):
            length_constraint = "one_word"
        elif bool(re.search(r"\b(one sentence|single sentence|in a sentence)\b", lower)):
            length_constraint = "one_sentence"
        elif bool(re.search(r"\b(one paragraph|single paragraph)\b", lower)):
            length_constraint = "one_paragraph"
        elif bool(re.search(r"\b(brief|concise|shortly|tl;?dr)\b", lower)):
            length_constraint = "concise"

        output_style = "standard"
        if bool(re.search(r"\b(table|tabular|columns and rows)\b", lower)):
            output_style = "table"
        elif bool(re.search(r"\b(summary|bullet points?|bullet list|bullets)\b", lower)):
            output_style = "bullet_summary"
        elif bool(re.search(r"\b(answer only|direct answer|just the answer|no intro|no explanation)\b", lower)):
            output_style = "direct_answer_only"

        suppress_scaffolding = (
            length_constraint in ["one_word", "one_sentence"]
            or output_style == "direct_answer_only"
            or bool(re.search(r"\b(answer only|no pleasantries|no follow-?up|no chit-?chat)\b", lower))
        )

        if is_study_notes:
            clean_topic = _clean_topic_string(
                re.sub(r"\b(give me|make|create|prepare|generate|summarize|as)?\s*(study notes?|cheat sheet|revision notes?|study map|notes?)\s*(on|for|about)?\s*", "", lower, flags=re.IGNORECASE)
            )
            topic = (clean_topic.title() if clean_topic and len(clean_topic) > 2 else current_subject)
            return QueryPlan(
                intent="STUDY_NOTES_REQUEST",
                reasoning="Heuristic fallback: matched explicit study-notes keywords.",
                sub_questions=[raw_msg],
                target_topic=topic,
                search_queries=[q for q in [topic, raw_msg] if q],
                response_format="study_notes",
                confidence=0.5,
                needs_clarification=False,
                recommended_action="EXPLAIN",
            )

        if is_quiz:
            return QueryPlan(
                intent="QUIZ_REQUEST",
                reasoning="Heuristic fallback: matched quiz-request keywords.",
                sub_questions=[raw_msg],
                target_topic=current_subject,
                search_queries=[current_subject or "important concepts", raw_msg],
                response_format="quiz",
                confidence=0.4,
                needs_clarification=False,
                recommended_action="QUIZ_QUESTION",
            )
        if is_question:
            clean_topic = _clean_topic_string(
                re.sub(r"^(what are the most important concepts in)\s+", "", lower, flags=re.IGNORECASE)
            )
            fmt = "comparison" if is_comparison else ("diagram" if is_diagram else "conceptual")
            topic = (clean_topic.title() if clean_topic and len(clean_topic) > 2 else current_subject)
            return QueryPlan(
                intent="EXPLANATION_REQUEST",
                reasoning="Heuristic fallback: message matched question patterns.",
                sub_questions=[raw_msg],
                target_topic=topic,
                search_queries=[q for q in [topic, raw_msg] if q],
                response_format=fmt,
                length_constraint=length_constraint,
                output_style=output_style,
                suppress_scaffolding=suppress_scaffolding,
                requires_table_data=is_comparison or output_style == "table",
                requires_image_data=is_diagram,
                visual_modality="generative_diagram" if is_diagram else "none",
                suggested_diagram_type="architecture" if "architecture" in lower else ("flowchart" if is_diagram else None),
                confidence=0.9,
                needs_clarification=False,
                recommended_action="EXPLAIN",
            )

        subj_title = raw_msg.title()
        return QueryPlan(
            intent="NEW_SUBJECT_DECLARATION",
            reasoning="Heuristic fallback: no question markers found, treating as a subject name.",
            sub_questions=[raw_msg],
            target_topic=subj_title,
            search_queries=[subj_title],
            extracted_subject=subj_title,
            response_format="conceptual",
            confidence=0.35,
            needs_clarification=True,
            recommended_action="SET_SUBJECT",
        )


# Singleton instance (kept for drop-in compatibility with existing imports)
query_analyzer = QueryAnalyzerAgent()
