"""
Decision Agent — Professional Academic AI Tutor & Multi-Source Document Q&A Engine.
Implements the recommended AI Tutor Processing Architecture & System Prompt:
- Source-type awareness (text, table, image_caption)
- Precise page citations: (p. 4)
- Structured table reasoning & visual diagram explanations
- Honest confidence limits without hallucination
- Non-blocking processing status awareness
"""
import re
import json
from typing import Dict, Any, List, Optional
from app.rag.ollama_client import ollama
from app.rag.user_memory import user_memory_store
import asyncio


class DecisionAgent:
    """
    Academic AI Mentor and Document Q&A Agent with source_type tagged retrieval,
    table comprehension, image figure grounding, student memory personalization, and pedagogical step-by-step reasoning.
    """

    SYSTEM_PROMPT = """You are DeepTutor, an advanced AI reasoning tutor that analyzes student queries, thinks through their learning goals and format requests, and provides grounded academic responses based on their retrieved course material.

AGENT REASONING & THINKING PROCESS:
Before answering, think carefully through:
1. Student Intent & Format: What specifically is the student asking for? (e.g. bullet points, deep intuition, formula derivation, code, or high-yield summary)
2. Retrieved Material Grounding: What relevant facts, definitions, or table/figure data exist in the retrieved context?
3. Student Profile: Match their learning style and address any known struggle areas.
Document your brief reasoning chain (1–2 sentences) in the "thought_process" field.

RESPONSE GUIDELINES:
- Adapt structure dynamically to the student's query:
  - If the student asks for **comparison / difference / vs / trade-offs** (e.g. "difference between SVM and KNN", "compare X and Y", "X vs Y"):
    1. Start with a 1-sentence intuitive hook contrasting the two approaches in simple words.
    2. Present the core distinctions in a **Clean Markdown Comparison Table** with columns:
       `| Dimension / Feature | {Concept A} | {Concept B} |`
       Covering rows like **Learning Paradigm**, **Decision Boundary / Mechanism**, **Computational Complexity**, and **Best Used For**.
    3. Provide a **Concrete Real-World Example** (`**Example:** ...`) contrasting how both handle the exact same scenario.
    4. End with a 1-sentence application recall question.
  - If the student asks for **bullet points / list**: Provide clean, structured markdown bullet points with bold headers and a short example.
  - If the student asks for **conceptual explanation**:
    1. Start with an intuitive, plain-language hook (no jargon).
    2. Provide the precise definition with key terms in bold.
    3. Break down key components with bold labels.
    4. Provide a **Concrete Real-World Example** (`**Example:** ...`) with simple numbers or everyday scenario so the student understands immediately.
    5. End with a 1-sentence application recall question to test understanding.
  - If the student asks for **diagram / image / architecture explanation**:
    1. Start with an intuitive real-world analogy hook (e.g. panel of specialists voting).
    2. Define the exact architecture / figure clearly with proper technical terms (e.g. Random Forest, Bagging).
    3. Break down the visual workflow step-by-step with bold labels (e.g. **Root Dataset / Sub-sampling**, **Parallel Decision Trees**, **Majority Voting / Averaging Aggregator**).
    4. Provide a **Concrete Example** (e.g. `**Example:** If 100 trees evaluate an email, 85 vote "Spam" and 15 vote "Inbox", the final decision is "Spam"`).
    5. Highlight the primary performance advantage (e.g. variance reduction and overfitting prevention).
    6. End with a 1-sentence application check question.
- **DO NOT INCLUDE PAGE NUMBERS OR PAGE CITATIONS** (e.g. never write "(p. 50)", "(p. 4)", or "on page 12"). Keep explanations clean and seamless without page citations.
- **NEVER OUTPUT LITERAL LABELS LIKE "HOOK:", "DEFINITION:", "BREAKDOWN:", "VISUAL:", "CLOSE:" AS TEXT.** Write in natural, clean, beautifully formatted Markdown.


CRITICAL MATERIAL GROUNDING & "UNKNOWN ANSWER" RULES:
1. **STRICTLY BASE RESPONSES ON RETRIEVED MATERIAL**: All explanations, examples, definitions, and quizzes MUST be grounded strictly in the student's uploaded course material and retrieved chunks.
2. **WHEN THE ANSWER IS NOT FOUND IN THE PDF / UNKNOWN**:
   - If the student's question is NOT answered in the retrieved course material or you cannot find sufficient information in the PDF:
     - **Do NOT guess, invent, or hallucinate an answer.**
     - **Explicitly tell the student**: "I could not find the answer to this in your uploaded PDF."
     - **Prompt the student**: "Please ask questions specifically related to the concepts and chapters in your uploaded material for **{Subject}** (e.g. {List of available syllabus topics})."
3. **NEVER MISTAKE A CONCEPTUAL QUESTION FOR A SUBJECT TITLE**: If the user asks a question like "what is the type of forest in india", "how does SVM work", or "explain photosynthesis", NEVER treat it as a subject name or say "Understood. Let's study what is the type of forest in india". Answer the question directly using the document context, or state that it is not in the uploaded material.
4. Match tone to an expert peer mentor: warm, articulate, clear, and direct. No emojis.



INTENT HANDLING & INTERACTIVE ONBOARDING RULES:
1. GREETING / INITIAL TURN: If the user says "Hi", "Hello", "Hey" or begins a session -> intent: "GREETING", extracted_subject: null, is_explanation: false, reply: Greet the student warmly and ask Question 1: "What subject, exam, or core concept would you like to master today?"
2. SUBJECT_SPECIFIED (TURN 2 DIAGNOSTIC QUESTION): When the user names a subject or broad topic (e.g. "machine learning", "geography", "linear algebra") -> intent: "SUBJECT_SPECIFIED", extracted_subject: "Proper Subject Name (e.g. Machine Learning)", is_explanation: false, reply: "Excellent! Let's focus on **{Subject}**.\n\nTo tailor our session, what is your current experience level, and are there specific chapters or exam goals you want to prioritize?"
3. ONBOARDING COMPLETE (TURN 3+): When the user answers their goals/level -> Acknowledge their goal enthusiastically and announce: "Understood! Our study workspace for **{Subject}** is ready. You can now attach your textbook or syllabus PDF using the attachment clip below to build your study roadmap, or ask any question to begin!"
4. QUIZ / QUESTION MODE (CRITICAL ONE-BY-ONE RULE):
   - When the student asks to be tested or asked questions (e.g. "ask me 5 questions", "quiz me", "test my knowledge", "ask questions"):
     - **NEVER OUTPUT MULTIPLE QUESTIONS AT ONCE.**
     - Ask **Question 1 of N**.
     - Populate `quiz_data` with the question and options.
     - In `"reply"`, write ONLY a brief warm intro (e.g. "Let's test your knowledge on {Topic}!"). **DO NOT print the A/B/C/D options or "Type your answer" in the reply text**, because the interactive quiz card handles options below.
   - When the student replies with an answer (e.g. "A", "B", or a short explanation):
     - **Evaluate their answer instantly** in 1-2 encouraging sentences in `"reply"` (e.g. "Spot on! Option A is correct because...").
     - Populate `quiz_data` with the next question (Question 2 of N) and its options.
     - When all questions are finished, provide a final completion praise and mastery summary in `"reply"`.
5. QUESTION / EXPLANATION: When the user asks a specific conceptual question (e.g. "What is an LLM?", "Explain how transformers work", "Parts of a circle in bullet points") -> intent: "QUESTION", is_explanation: true, reply: Provide the tailored, well-structured explanation according to the guidelines above.


JSON SCHEMA:
{
  "thought_process": "Brief 1-2 sentence internal reasoning analyzing the query, context, and formatting choice.",
  "intent": "GREETING" | "SUBJECT_SPECIFIED" | "QUESTION" | "QUIZ_QUESTION" | "EVALUATE_AND_NEXT_QUESTION",
  "extracted_subject": "string or null",
  "is_explanation": true | false,
  "quiz_data": {
    "question_number": 1,
    "total_questions": 5,
    "question_text": "Question text here",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct_option": "A",
    "evaluation": "Evaluation of previous answer if answering, otherwise null",
    "is_completed": false
  } | null,
  "reply": "Clean Markdown formatted text of the question or answer evaluation"
}


"""

    async def analyze_and_respond(
        self,
        message: str,
        current_subject: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        context: Optional[str] = None,
        file_name: Optional[str] = None,
        doc_status_note: Optional[str] = None,
        user_id: str = "default_user",
        user_name: Optional[str] = None,
        difficulty: str = "standard",
    ) -> Dict[str, Any]:
        """
        Analyzes user message with Gemini, thinks through the query intent,
        and returns structured reasoning + response tailored to the question without page numbers.
        """
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
        ]

        if difficulty == "easier":
            messages.append({
                "role": "system",
                "content": (
                    "DIFFICULTY LEVEL: SIMPLIFIED / EASIER\n"
                    "- Use intuitive real-world analogies; minimize technical jargon.\n"
                    "- Provide concise breakdown points (max 2).\n"
                    "- Do NOT include page numbers.\n"
                    "- Keep recall question simple and concrete.\n"
                    "- Do NOT say 'here is the simpler version' — answer directly at the easier level."
                )
            })

        # Student Memory profile injection
        memory_str = user_memory_store.format_memory_for_prompt(user_id)
        if memory_str:
            messages.append({
                "role": "system",
                "content": f"STUDENT LEARNING PROFILE & MEMORY:\n{memory_str}"
            })

        if current_subject:
            messages.append({
                "role": "system",
                "content": f"Current Active Subject: {current_subject}"
            })

        if doc_status_note:
            messages.append({
                "role": "system",
                "content": f"DOCUMENT PROCESSING STATUS: {doc_status_note}"
            })

        if context and context.strip():
            doc_label = f"from '{file_name}'" if file_name else "from uploaded document"
            messages.append({
                "role": "system",
                "content": f"RETRIEVED CONTEXT CHUNKS ({doc_label}):\n\n{context.strip()}\n\nSTRICT INSTRUCTION: Ground your answer ONLY in the uploaded course material above. If the student asks something outside this material (e.g. unrelated coding, general chatbot queries), politely decline and redirect them back to their syllabus topics."
            })


        if history:
            for h in history[-6:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

        messages.append({"role": "user", "content": f"Student's question: {message}"})

        # Trigger non-blocking background memory extraction
        asyncio.create_task(user_memory_store.auto_extract_and_update(user_id, message, history))

        try:
            raw = await ollama.chat(messages, temperature=0.2)
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("\n", 1)[0]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()

            # Clean raw response
            data = None
            if "{" in cleaned and "}" in cleaned:
                start_idx = cleaned.find("{")
                end_idx = cleaned.rfind("}")
                json_str = cleaned[start_idx : end_idx + 1]
                try:
                    data = json.loads(json_str, strict=False)
                except Exception:
                    # Fallback: extract "reply" and "thought_process" with regex
                    reply_match = re.search(r'"reply"\s*:\s*"((?:\\.|[^"\\])*)"', json_str, re.DOTALL)
                    thought_match = re.search(r'"thought_process"\s*:\s*"((?:\\.|[^"\\])*)"', json_str, re.DOTALL)
                    if reply_match:
                        raw_reply = reply_match.group(1).encode().decode('unicode_escape', 'ignore')
                        raw_thought = thought_match.group(1).encode().decode('unicode_escape', 'ignore') if thought_match else ""
                        data = {"reply": raw_reply, "thought_process": raw_thought, "is_explanation": True}

            if data and isinstance(data, dict) and "reply" in data and data["reply"]:
                reply = data["reply"]
            else:
                # If LLM returned raw markdown/text without JSON wrapper, use cleaned directly
                reply = cleaned


            # Clean and sanitize reply
            reply = re.sub(r'[\U00010000-\U0010ffff]', '', reply).strip()
            reply = re.sub(r'^(?:HOOK|DEFINITION|BREAKDOWN|VISUAL|CLOSE):\s*', '', reply, flags=re.MULTILINE)
            reply = re.sub(r'\[Source:[^\]]*\]', '', reply)
            reply = re.sub(r'\s*\((?:p\.|pages?)\s*\d+(?:[-–]\d+)?\)', '', reply, flags=re.IGNORECASE)
            reply = re.sub(r'\b(?:on|from|see)\s+pages?\s+\d+(?:[-–]\d+)?\b', '', reply, flags=re.IGNORECASE)
            reply = re.sub(r'\n{3,}', '\n\n', reply).strip()

            thought = data.get("thought_process") if data else "Analyzed question against uploaded material and synthesized a clear, simple explanation."
            intent = data.get("intent", "QUESTION") if data else "QUESTION"
            is_expl = data.get("is_explanation", True) if data else True

            if intent in ["GREETING", "SUBJECT_SPECIFIED"]:
                is_expl = False

            return {
                "thought_process": thought,
                "intent": intent,
                "extracted_subject": data.get("extracted_subject") if data else None,
                "is_explanation": is_expl,
                "quiz_data": data.get("quiz_data") if data else None,
                "reply": reply,
            }

        except Exception as e:
            print(f"[DecisionAgent] LLM exception: {e}, formatting clean fallback...")

        # Fallback handler with clean text extraction
        lower = message.lower().strip()
        is_greeting = bool(re.search(r"\b(hi|hello|hey|good morning|good evening|greetings)\b", lower))

        if is_greeting and not any(kw in lower for kw in ["learn", "study", "exam", "help", "rows", "columns", "what", "how", "why", "table", "forest"]):
            return {
                "thought_process": "Student greeted. Prompting them to choose a study subject or topic.",
                "intent": "GREETING",
                "extracted_subject": None,
                "is_explanation": False,
                "reply": "Hello! Welcome to DeepTutor. What subject or concept would you like to explore today?",
            }
        elif context:
            clean_ctx = re.sub(r'\[Source:[^\]]*\]', '', context)
            clean_ctx = re.sub(r'\s*\((?:p\.|pages?)\s*\d+(?:[-–]\d+)?\)', '', clean_ctx)
            clean_ctx = re.sub(r'\s+', ' ', clean_ctx).strip()
            # Extract first 2-3 clean sentences
            sentences = [s.strip() for s in re.split(r'\. |\.\n', clean_ctx) if len(s.strip()) > 15][:3]
            summary_text = ". ".join(sentences) + "." if sentences else clean_ctx[:300]

            return {
                "thought_process": "Extracted foundational definition from course materials.",
                "intent": "QUESTION",
                "extracted_subject": current_subject,
                "is_explanation": True,
                "reply": f"{summary_text}\n\n**Quick check:** What is the key takeaway from this concept?",
            }
        else:
            is_question = any(q in lower for q in ["what", "how", "why", "when", "where", "which", "explain", "describe", "types", "difference", "compare", "?"])
            if is_question:
                return {
                    "thought_process": "Question asked but answer could not be found in uploaded material.",
                    "intent": "QUESTION",
                    "extracted_subject": current_subject,
                    "is_explanation": True,
                    "reply": f"I could not find information about this in your uploaded PDF. Please ask questions specifically related to your uploaded course material for **{current_subject or 'this subject'}**, or upload the relevant chapter notes.",
                }
            else:
                subj_title = message.strip().title()
                return {
                    "thought_process": f"Subject specified as {subj_title}. Awaiting syllabus or notes upload.",
                    "intent": "SUBJECT_SPECIFIED",
                    "extracted_subject": subj_title,
                    "is_explanation": False,
                    "reply": f"Understood! Let's focus on **{subj_title}**.\n\nPlease upload your study notes using the attachment button below, or ask a question from your course material.",
                }


# Singleton instance
decision_agent = DecisionAgent()



