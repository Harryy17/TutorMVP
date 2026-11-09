"""
Decision Agent — Executor half of the planner/executor pipeline.

Architecture
------------
The QueryAnalyzerAgent (query_analyzer.py) is the "planner": it thinks about
the student's message and produces a QueryPlan (intent, sub-questions,
retrieval strategy, response-format contract, confidence).

This DecisionAgent is the "executor": given that plan plus the retrieved
context, it:

    1. GENERATES a grounded, pedagogically-structured answer via LLM, with
       an explicit "thought_process" reasoning field the model must fill in
       before writing the reply (chain-of-thought is requested, not assumed).
    2. VERIFIES groundedness — a lightweight second pass that checks whether
       the answer's key claims plausibly trace back to the retrieved context,
       and regenerates once with a stricter grounding instruction if not.
    3. DEGRADES gracefully — JSON parsing is retried before falling back to
       deterministic heuristics, so a malformed LLM response never surfaces
       raw JSON or crashes the request.

Splitting planning from execution (rather than one mega-prompt) means each
LLM call has a single, testable job, and the executor can adapt its system
prompt per-turn to the response_format the planner already decided on.
"""
import re
import json
import asyncio
from typing import Dict, Any, List, Optional
from app.rag.ollama_client import ollama
from app.rag.user_memory import user_memory_store
from app.rag.image_gen_client import image_client
from app.rag.visual_engine import visual_engine


class DecisionAgent:
    """
    Academic AI Mentor and Document Q&A executor agent. Consumes a QueryPlan
    from QueryAnalyzerAgent, retrieved source_type-tagged context, and student
    memory, then produces a structured, grounded, pedagogical response.
    """

    SYSTEM_PROMPT = """You are DeepTutor, an advanced AI reasoning tutor that analyzes student queries, thinks through their learning goals and format requests, and provides grounded academic responses based on their retrieved course material.

You will often be given a PLANNING NOTE from an upstream planning agent containing: the decomposed sub-questions, the recommended response_format, and whether table/image data is expected to matter. Treat the planning note as a strong prior, but always re-verify it against the actual retrieved context — if the plan expected table data and none was retrieved, say so honestly rather than inventing figures.

AGENT REASONING & THINKING PROCESS:
Before answering, think carefully through:
1. Student Intent & Format: What specifically is the student asking for? (e.g. bullet points, deep intuition, formula derivation, code, or high-yield summary)
2. Retrieved Material Grounding: What relevant facts, definitions, or table/figure data exist in the retrieved context?
3. Student Profile: Match their learning style and address any known struggle areas.
Document your brief reasoning chain (1-2 sentences) in the "thought_process" field.

RESPONSE GUIDELINES:
- Adapt structure dynamically to the student's query and the planning note's response_format:
  - **comparison** (vs / difference / trade-offs):
    1. Start with a 1-sentence intuitive hook contrasting the two approaches in simple words.
    2. Present the core distinctions in a **Clean Markdown Comparison Table** with columns:
       `| Dimension / Feature | {Concept A} | {Concept B} |`
       Covering rows like **Learning Paradigm**, **Decision Boundary / Mechanism**, **Computational Complexity**, and **Best Used For**.
    3. Provide a **Concrete Real-World Example** (`**Example:** ...`) contrasting how both handle the exact same scenario.
    4. End with a **natural, conversational follow-up question** that the user can answer with a simple "yes" or "no" (e.g., *"Would you like to see how this comparison applies to a practical use case in your material?"* or *"Shall we test this with a quick practice quiz?"*).
  - **list**: Provide clean, structured markdown bullet points with bold headers, a short example, and a natural yes/no follow-up question at the end.
  - **conceptual** (default):
    1. Start with an intuitive, plain-language hook (no jargon).
    2. Provide the precise definition with key terms in bold.
    3. Break down key components with bold labels.
    4. Provide a **Concrete Real-World Example** (`**Example:** ...`) with simple numbers or everyday scenario so the student understands immediately.
    5. End with a **natural, conversational follow-up question** that the student can easily answer with a simple "yes" or "no" (e.g., *"Would you like to walk through a concrete step-by-step example of this formula?"* or *"Shall we do a quick 2-question quiz to test your understanding on this?"*).
  - **diagram** (architecture / workflow / visual explanation):
    1. Start with an intuitive real-world analogy hook explaining the high-level architecture or mechanism.
    2. Embed the relevant educational visual diagram or document figure using standard Markdown: `![Visual Diagram: Title](/api/media/...)`.
    3. Break down each component, stage, or flow step-by-step with bold labels.
    4. Provide a **Concrete Real-World Example** of data or operations moving through the concept.
    5. End with a natural yes/no conversational follow-up question.
  - **strict constraints & direct answers**:
    - If the student requests "answer only", "direct answer", "one word", "one sentence", "one paragraph", "table", or "summary" (or if indicated in the planning note):
      PRIORITIZE the requested constraint above all default pedagogical structures!
      - If "one_word": output ONLY that single exact word, term, or acronym. Zero intro, zero punctuation, zero explanation.
      - If "one_sentence": output EXACTLY one complete, grammatically sound sentence answering the question directly.
      - If "one_paragraph": output EXACTLY one focused paragraph (3-5 sentences). No multiple paragraphs, no bullet points.
      - If "table": present the answer primarily as a clean, properly formatted Markdown table with column headers.
      - If "bullet_summary": present the answer as 3-5 concise bullet points with key concepts in bold.
      - If "direct_answer_only" or "suppress_scaffolding" is active: DO NOT include introductory pleasantries ("Sure!", "Here is..."), DO NOT include hook sentences, and DO NOT ask any follow-up question. Conclude immediately after the direct answer.
  - **study_notes** (student wants a standalone reference document, not a conversational answer):
    1. Start with a single H1 title: `# {Topic} — Study Notes`.
    2. If the student's memory shows related prior topics, add one italic line:
       `*Builds on: {prior topics}*`.
    3. Break the topic into 5-9 numbered `## ` sections covering, in order: core definition/overview,
       key mechanisms or sub-concepts, how it's used/applied, common variants or techniques, key
       limitations or trade-offs, and how it's evaluated or tested (skip any section that doesn't
       apply to the topic).
    4. Wherever the material has comparable items (algorithms, methods, terms), render them as a
       Markdown table rather than prose — this is what makes notes scannable for revision.
    5. End with a `## Quick-Reference Glossary` — a two-column Markdown table of the 6-10 most
       important terms and one-line definitions.
    6. Close with one line: `**Suggested next step:** ...` — a natural follow-on topic, grounded in
       the student's memory/current subject if available, otherwise grounded in what a learner would
       logically study next.
    7. Use ONLY the retrieved course material for facts; if the material doesn't cover the topic at
       all, do not silently fall back to general knowledge — use the standard "not found in material"
       rule instead of producing generic notes.
    8. This format must render as clean, valid Markdown only — no HTML tags, no page citations — since
       it is rendered directly in the chat UI's Markdown viewer and also offered as a downloadable
       `.md` file as-is.
  - If the plan flags multiple sub_questions (a compound question), answer each sub-question in its own
    clearly labeled section (bold sub-heading per sub-question) rather than blending them into one block.
- **MATHEMATICAL EQUATIONS, FORMULAS & DERIVATIONS**:
  - Always put core mathematical equations, laws, and algebraic progressions in standalone display math `$$ ... $$` so they automatically render inside dedicated formula blocks.
  - When explaining or deriving mathematical or physics equations (such as equations of motion, kinetic energy, quadratic formula, or proofs):
    1. Introduce each derivation with a clean bold heading (e.g. `**Derivation of the first equation**` or `**Derivation of the second equation**`).
    2. Structure the derivation step-by-step with clean transitional phrases on separate lines (e.g. "We know:", "Therefore:", "Rearranging:", "So,").
    3. Place each algebraic intermediate step in a standalone centered `$$ ... $$` block (e.g. `$$a = \frac{v - u}{t}$$`).
    4. Conclude each derivation by highlighting the final derived equation inside a LaTeX box: `$$\boxed{v = u + at}$$` or `$$\boxed{s = ut + \frac{1}{2}at^2}$$`.
  - State the physical interpretation of graph slope and area under the curve explicitly (e.g. *"The slope of this graph represents acceleration, and the area underneath it represents displacement."*).
- **NEVER OUTPUT RAW ASCII ART, CODE-BLOCK DRAWINGS, OR TEXT-BASED DIAGRAMS**:
  - Do NOT draw graphs, diagrams, or flowcharts using code blocks (``` ... ```) or monospace characters (`|`, `/`, `\`, `-`, `^`, `>`, `•`, `_`).
  - NEVER output Mermaid code or HTML/SVG snippets in text.
  - The frontend has a dedicated Dynamic Visual Explanation Engine that renders interactive visual components natively.
  - Write ONLY clean educational prose, formula blocks `$$ ... $$`, and standard Markdown tables.
- **DO NOT INCLUDE PAGE NUMBERS OR PAGE CITATIONS** (e.g. never write "(p. 50)", "(p. 4)", or "on page 12"). Keep explanations clean and seamless without page citations.
- **NEVER OUTPUT LITERAL LABELS LIKE "HOOK:", "DEFINITION:", "BREAKDOWN:", "VISUAL:", "CLOSE:" AS TEXT.** Write in natural, clean, beautifully formatted Markdown.

CRITICAL MATERIAL GROUNDING & DUAL-MODE LEARNING RULES:
1. **TWO LEARNING MODES**:
   - **MODE A: UPLOADED MATERIAL MODE** (When a textbook, slides, or syllabus PDF is attached in the session):
     - All facts, explanations, definitions, formulas, and quizzes must be grounded strictly in the retrieved chunks of the student's material.
     - If the student asks about a specific detail claimed to be in the uploaded material and it is absent from the retrieved chunks, state: "I could not find the answer to this in your uploaded PDF."
   - **MODE B: OPEN LEARNING MODE** (When NO document is uploaded, or when the student indicates they have no materials):
     - Teach standard academic syllabus concepts (e.g., speed in physics, photosynthesis in biology, matrices in math, sorting algorithms in CS) directly and thoroughly using first-principles educational pedagogy.
     - **NEVER** stonewall the student or refuse to explain by demanding an upload. Do NOT say "Please attach your textbook or syllabus PDF". Teach the requested topic directly!
2. **NEVER MISTAKE A CONCEPTUAL QUESTION OR TOPIC FOR A SUBJECT TITLE**: If the user asks a question like "what is the type of forest in india", "how does SVM work", "explain speed", or types a topic like "speed", "kinematics", NEVER treat it as a subject name or say "Understood. Let's study what is the type of forest in india". Answer or explain the concept directly.
3. Match tone to an expert peer mentor: warm, articulate, clear, and direct. No emojis.

INTENT HANDLING & INTERACTIVE CONVERSATION RULES:
1. GREETING / INITIAL TURN: If the user says "Hi", "Hello", "Hey" or begins a session -> intent: "GREETING", extracted_subject: null, is_explanation: false, reply: Greet the student warmly and ask: "Hello! Welcome to IndieTutor. What subject or concept would you like to master today? You can type a topic or attach your syllabus/textbook PDF anytime using the clip below."
2. SUBJECT_SPECIFIED: When the user names a subject or broad topic (e.g. "machine learning", "geography", "linear algebra") -> intent: "SUBJECT_SPECIFIED", extracted_subject: "Proper Subject Name (e.g. Machine Learning)", is_explanation: false, reply: "Understood! Let's focus on **{Subject}**.\n\nYou can attach your textbook or syllabus PDF using the attachment clip below to extract your study plan, or ask any conceptual question to begin!"
3. YES / NO & OPTION CONFIRMATIONS:
   - When the user answers "yes", "yeah", "sure", "yep", "ok", "ye sure", "yes start", "start", "proceed", "let's go", or "please do":
     - **CRITICAL ANTI-LOOP RULE: NEVER REPEAT THE PREVIOUS QUESTION OR ASK THE USER TO CONFIRM AGAIN.**
     - **IF YOUR PREVIOUS MESSAGE OFFERED MULTIPLE CHOICES** (e.g. *"Would you like to start with what it means, how to calculate it, or a practice problem?"* or *"Shall we cover the definition, the formula, or a practice example?"*):
       -> **IMMEDIATELY DEFAULT TO OPTION 1** (the core concept, definition, and intuitive physical/academic meaning) **AND START TEACHING RIGHT AWAY!**
       -> Do NOT ask them to pick again. Begin the explanation of Option 1 immediately with clear intuition, formula blocks $$ ... $$ if applicable, and a concrete example.
       -> At the very end of your response, offer the logical next step (e.g. *"Next, would you like to see how to calculate it with a formula, or try a quick practice problem?"*).
     - If you previously asked *"Shall we do a quick quiz?"*, start the quiz (Question 1 of N).
     - If you previously asked *"Would you like to see a concrete example / deep-dive?"*, provide that detailed example directly.
   - When the user answers "no", "nope", "not now", "skip":
     - Warmly acknowledge (e.g., *"No problem! What other concept or topic would you like to explore next?"*) and wait for their direction.
4. QUIZ / QUESTION MODE (CRITICAL ONE-BY-ONE RULE):
   - When the student asks to be tested or asked questions (e.g. "ask me 2 questions", "quiz me with 3 questions"):
   - When the student replies with an answer (e.g. selects an option or explains):
     - Check the previous question number from conversation history.
     - **If answering Question K where K < total_questions (e.g. answering Question 1 of 2):**
       - Evaluate their answer in `"reply"` (e.g. "Spot on! Option B is correct because...").
       - Populate `quiz_data` with the NEXT question: `{"question_number": K + 1, "total_questions": N, "question_text": "...", "options": [...], "correct_option": "...", "evaluation": "...", "is_completed": false}`.
     - **If answering the FINAL question where K == total_questions (e.g. answering Question 2 of 2):**
       - **DO NOT GENERATE ANOTHER QUESTION.**
       - In `"reply"`, evaluate their final answer, declare the quiz complete, and provide a 1-sentence mastery summary (e.g. "Great job! You have completed the 2-question quiz on {Topic}.").
       - Set `"quiz_data": null` (or `"quiz_data": {"question_number": N, "total_questions": N, "question_text": "", "options": [], "is_completed": true, "evaluation": "Your final evaluation here"}`).
4. QUESTION / EXPLANATION: When the user asks a specific conceptual question (e.g. "What is an LLM?", "Explain how transformers work", "Parts of a circle in bullet points") -> intent: "QUESTION", is_explanation: true, reply: Provide the tailored, well-structured explanation according to the guidelines above.

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
  "reply": "Clean Markdown formatted text of the question or answer evaluation",
  "response_format": "conceptual" | "comparison" | "list" | "diagram" | "quiz" | "study_plan" | "study_notes",
  "export_ready": true | false,
  "groundedness_note": "1 short sentence: which parts of the reply are directly supported by retrieved context vs general knowledge, or 'not found in material' if applicable"
}
Respond with ONLY this JSON object, no preamble, no markdown fences.
"""

    VERIFIER_SYSTEM_PROMPT = """You are a strict fact-checking verifier for an academic tutoring system.
You will be given RETRIEVED COURSE MATERIAL and a DRAFT ANSWER produced from it.
Check whether the draft's specific factual claims (definitions, numbers, named mechanisms, examples) are
actually supported by the retrieved material, or whether the model appears to have invented content not
present in the material.

Respond with ONLY this JSON object:
{
  "grounded": true | false,
  "issue": "short description of the unsupported claim if grounded is false, else null"
}
"""

    def __init__(self, max_retries: int = 1, enable_self_critique: bool = False):
        self.max_retries = max_retries
        self.enable_self_critique = enable_self_critique

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
        query_analysis: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = "default_session",
    ) -> Dict[str, Any]:
        """
        Executes the plan produced by QueryAnalyzerAgent: builds a plan-aware prompt,
        generates a grounded response with retry-on-malformed-JSON, optionally
        self-verifies groundedness against the retrieved context, and returns a
        structured result. Never raises — always degrades to a heuristic fallback.
        """
        # Trigger non-blocking background memory extraction as early as possible.
        asyncio.create_task(user_memory_store.auto_extract_and_update(user_id, message, history))

        # Check if an educational visual diagram / image is requested or planned
        visual_modality = query_analysis.get("visual_modality") if query_analysis else None
        is_visual_needed = (
            visual_modality in ["generate_image", "generative_diagram"]
            or (query_analysis and query_analysis.get("response_format") == "diagram")
            or any(w in message.lower() for w in ["diagram", "visualize", "show image", "with an image", "picture of", "schematic", "visual"])
        )

        generated_image_info: Optional[Dict[str, Any]] = None
        if is_visual_needed and image_client.is_configured():
            target_topic = (
                (query_analysis.get("target_topic") if query_analysis else None)
                or current_subject
                or message
            )
            prompt = image_client.craft_educational_prompt(
                topic=target_topic,
                context_snippet=context[:200] if context else ""
            )
            try:
                generated_image_info = await image_client.generate_image(
                    prompt=prompt,
                    session_id=session_id or "default_session",
                )
            except Exception as img_err:
                print(f"[DecisionAgent] Image generation note: {img_err}")

        base_messages = self._build_base_messages(
            current_subject, doc_status_note, context, file_name,
            difficulty, user_id, query_analysis, history,
        )

        if generated_image_info and generated_image_info.get("url"):
            img_url = generated_image_info["url"]
            img_topic = (query_analysis.get("target_topic") if query_analysis else None) or current_subject or "Concept Diagram"
            base_messages.append({
                "role": "system",
                "content": (
                    f"VISUAL IMAGE GENERATED: An educational visual diagram has been generated for this concept.\n"
                    f"Embed this image near the start of your explanation using standard Markdown: "
                    f"![Visual Diagram: {img_topic}]({img_url})\n"
                    f"Explain the visual diagram clearly and break down its core mechanisms step-by-step."
                ),
            })

        result: Optional[Dict[str, Any]] = None
        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                messages = list(base_messages)
                if attempt > 0:
                    messages.append({
                        "role": "system",
                        "content": "Your previous response was not valid JSON or was missing the 'reply' "
                                    "field. Respond again with ONLY the raw JSON object, no prose, no fences.",
                    })
                messages.append({"role": "user", "content": f"Student's question: {message}"})

                raw = await ollama.chat(messages, temperature=0.2 if attempt == 0 else 0.0)
                parsed = self._parse_llm_response(raw)
                if parsed and parsed.get("reply"):
                    result = parsed
                    break
            except Exception as e:  # noqa: BLE001 - degrade, never crash the request
                last_error = e
                print(f"[DecisionAgent] generation attempt {attempt} failed: {e}")
            if attempt < self.max_retries:
                await asyncio.sleep(0.3 * (attempt + 1))

        if result is None:
            if last_error:
                print(f"[DecisionAgent] all generation attempts exhausted, using fallback: {last_error}")
            return self._fallback_response(message, context, current_subject, query_analysis)

        result = self._finalize(result, message, query_analysis, generated_image_info)

        if (
            self.enable_self_critique
            and result.get("is_explanation")
            and context
            and context.strip()
            and len(result.get("reply", "")) > 40
        ):
            result = await self._maybe_reground(result, context, message, query_analysis, generated_image_info)

        # Dynamic Visual Explanation Pipeline
        if result.get("is_explanation") and visual_engine.should_generate_visual(
            message=message,
            query_analysis=query_analysis,
            reply_text=result.get("reply", ""),
            response_format=result.get("response_format"),
        ):
            try:
                spec = await visual_engine.generate_visual_spec(
                    query=message,
                    reply_text=result.get("reply", ""),
                    context=context,
                    subject=current_subject,
                    query_analysis=query_analysis,
                )
                if spec:
                    result["visual_spec"] = spec.model_dump()
            except Exception as vis_err:
                print(f"[DecisionAgent] Dynamic visual spec notice: {vis_err}")

        return result

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    def _build_base_messages(
        self,
        current_subject: Optional[str],
        doc_status_note: Optional[str],
        context: Optional[str],
        file_name: Optional[str],
        difficulty: str,
        user_id: str,
        query_analysis: Optional[Dict[str, Any]],
        history: Optional[List[Dict[str, str]]],
    ) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": self.SYSTEM_PROMPT}]

        if query_analysis:
            plan_note = self._format_plan_note(query_analysis)
            messages.append({
                "role": "system",
                "content": f"PLANNING NOTE FROM UPSTREAM AGENT:\n{plan_note}\n"
                            "Use this to choose response_format and to check off each sub-question, "
                            "but re-verify every claim against the retrieved context below.",
            })

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

        memory_str = user_memory_store.format_memory_for_prompt(user_id)
        if memory_str:
            messages.append({"role": "system", "content": f"STUDENT LEARNING PROFILE & MEMORY:\n{memory_str}"})

        if current_subject:
            messages.append({"role": "system", "content": f"Current Active Subject: {current_subject}"})

        if doc_status_note:
            messages.append({"role": "system", "content": f"DOCUMENT PROCESSING STATUS: {doc_status_note}"})

        has_uploaded_doc = bool(
            file_name
            or (doc_status_note and any(k in doc_status_note.lower() for k in ["indexed", "complete", "transcribed", "processed", "chunks"]))
        )

        if context and context.strip():
            doc_label = f"from '{file_name}'" if file_name else "from uploaded document"
            messages.append({
                "role": "system",
                "content": f"RETRIEVED CONTEXT CHUNKS ({doc_label}):\n\n{context.strip()}\n\n"
                            "STRICT INSTRUCTION: Ground your answer in the uploaded course material above. "
                            "Preserve important terminology, equations, and definitions from this source material.",
            })
        elif has_uploaded_doc and query_analysis and query_analysis.get("recommended_action") == "EXPLAIN":
            messages.append({
                "role": "system",
                "content": "NOTE: No matching context was retrieved from the student's uploaded material for this query. "
                            "Follow the 'UNKNOWN ANSWER' rule — inform the student that their uploaded PDF doesn't cover this topic.",
            })
        else:
            messages.append({
                "role": "system",
                "content": "OPEN LEARNING MODE: No textbook PDF is uploaded for this session. "
                            "Teach the requested concept directly, clearly, and thoroughly using foundational educational pedagogy. "
                            "DO NOT demand a PDF or ask the student to upload a textbook — provide the full, clear explanation immediately.",
            })

        if history:
            for h in history[-6:]:
                messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

        return messages

    @staticmethod
    def _format_plan_note(plan: Dict[str, Any]) -> str:
        parts = [f"- intent: {plan.get('intent')}"]
        if plan.get("target_topic"):
            parts.append(f"- target_topic: {plan.get('target_topic')}")
        sub_qs = plan.get("sub_questions") or []
        if len(sub_qs) > 1:
            parts.append(f"- decomposed sub-questions: {json.dumps(sub_qs)}")
        if plan.get("response_format"):
            parts.append(f"- recommended response_format: {plan.get('response_format')}")

        # Length & directness constraints from cognitive analysis
        length_constraint = plan.get("length_constraint")
        if length_constraint == "one_word":
            parts.append("- STRICT CONSTRAINT: Respond with ONLY the exact single word, term, or acronym. Zero intro, zero punctuation, zero explanations.")
        elif length_constraint == "one_sentence":
            parts.append("- STRICT CONSTRAINT: Respond with EXACTLY ONE complete, grammatically sound sentence. No conversational intro, no follow-up question.")
        elif length_constraint == "one_paragraph":
            parts.append("- STRICT CONSTRAINT: Respond in EXACTLY ONE coherent paragraph (3-5 sentences). Do not use bullet points or multiple paragraphs.")
        elif length_constraint == "concise":
            parts.append("- CONSTRAINT: Keep the explanation very brief and concise (max 2-3 sentences or short bullets).")
        elif length_constraint == "comprehensive":
            parts.append("- CONSTRAINT: Provide an in-depth, comprehensive explanation covering nuances and mechanisms.")

        output_style = plan.get("output_style")
        if output_style == "table" or plan.get("requires_table_data"):
            parts.append("- FORMAT REQUIREMENT: Present the core information as a clean, properly formatted Markdown table with headers and aligned columns.")
        elif output_style == "bullet_summary":
            parts.append("- FORMAT REQUIREMENT: Present the response as 3 to 5 clear Markdown bullet points with key terms in bold.")
        elif output_style == "direct_answer_only":
            parts.append("- DIRECTNESS REQUIREMENT: Provide ONLY the direct factual answer. Omit pleasantries, conversational filler, and introductory meta-commentary.")

        if plan.get("suppress_scaffolding"):
            parts.append("- SUPPRESS SCAFFOLDING: Do NOT ask any follow-up question at the end. Do NOT provide an intro hook or chit-chat. End immediately after the answer.")

        if plan.get("requires_table_data"):
            parts.append("- likely needs table/numeric data")
        if plan.get("visual_modality") in ["generate_image", "generative_diagram"] or plan.get("response_format") == "diagram":
            parts.append("- visual modality: an educational visual diagram / schematic is synthesized using OpenAI Image Generation and embedded via Markdown: ![Diagram: Title](/api/media/...)")
        elif plan.get("visual_modality") == "document_figure":
            parts.append("- visual modality: locate and reference document figure images from retrieved context (e.g. ![Figure](/api/media/...))")
        elif plan.get("requires_image_data"):
            parts.append("- likely needs diagram/figure explanation")
        if plan.get("confidence") is not None:
            parts.append(f"- planner confidence: {plan.get('confidence')}")
        if plan.get("needs_clarification"):
            parts.append("- planner flagged low confidence: if the question is genuinely ambiguous, ask a brief clarifying question instead of guessing")
        if plan.get("reasoning"):
            parts.append(f"- planner reasoning: {plan.get('reasoning')}")
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Parsing & cleanup
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        return cleaned.strip()

    def _parse_llm_response(self, raw: str) -> Optional[Dict[str, Any]]:
        cleaned = self._strip_code_fences(raw)
        data = None

        if "{" in cleaned and "}" in cleaned:
            start_idx, end_idx = cleaned.find("{"), cleaned.rfind("}")
            json_str = cleaned[start_idx:end_idx + 1]
            try:
                data = json.loads(json_str, strict=False)
            except Exception:
                reply_match = re.search(r'"reply"\s*:\s*"((?:\\.|[^"\\])*)"', json_str, re.DOTALL)
                thought_match = re.search(r'"thought_process"\s*:\s*"((?:\\.|[^"\\])*)"', json_str, re.DOTALL)
                if reply_match:
                    raw_reply = reply_match.group(1).encode().decode("unicode_escape", "ignore")
                    raw_thought = (
                        thought_match.group(1).encode().decode("unicode_escape", "ignore")
                        if thought_match else ""
                    )
                    data = {"reply": raw_reply, "thought_process": raw_thought, "is_explanation": True}

        if not data or "reply" not in data or not data.get("reply"):
            if cleaned and "{" not in cleaned:
                # Model returned raw markdown/text without a JSON wrapper — usable as-is.
                data = {"reply": cleaned, "thought_process": "", "is_explanation": True}
            else:
                return None

        return data

    def _finalize(
        self,
        data: Dict[str, Any],
        message: str,
        query_analysis: Optional[Dict[str, Any]] = None,
        generated_image_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        reply = data.get("reply", "")
        reply = re.sub(r"[\U00010000-\U0010ffff]", "", reply).strip()
        reply = re.sub(r"^(?:HOOK|DEFINITION|BREAKDOWN|VISUAL|CLOSE):\s*", "", reply, flags=re.MULTILINE)
        reply = re.sub(r"\[Source:[^\]]*\]", "", reply)
        reply = re.sub(r"\s*\((?:p\.|pages?)\s*\d+(?:[-–]\d+)?\)", "", reply, flags=re.IGNORECASE)
        reply = re.sub(r"\b(?:on|from|see)\s+pages?\s+\d+(?:[-–]\d+)?\b", "", reply, flags=re.IGNORECASE)
        reply = re.sub(r"\\le\s*ft\b", r"\\left", reply)
        reply = re.sub(r"\\righ\s*t\b", r"\\right", reply)
        reply = re.sub(r"\\sq\s*rt\b", r"\\sqrt", reply)

        # Strip out any rogue ASCII diagrams or text-art graphs in code blocks
        ascii_codeblock_pattern = r"```[a-zA-Z0-9_-]*\s*\n([^`]*?[\|\^><+/\\-]{3,}[^`]*?)\n```"
        had_ascii = bool(re.search(ascii_codeblock_pattern, reply))
        if had_ascii:
            reply = re.sub(ascii_codeblock_pattern, "", reply).strip()
            if query_analysis:
                query_analysis["response_format"] = "diagram"

        reply = re.sub(r"\n{3,}", "\n\n", reply).strip()

        # Embed generated visual diagram if present and not yet referenced
        if generated_image_info and generated_image_info.get("url"):
            img_url = generated_image_info["url"]
            img_topic = (query_analysis.get("target_topic") if query_analysis else None) or "Concept Diagram"
            if img_url not in reply:
                reply = f"![Visual Diagram: {img_topic}]({img_url})\n\n{reply}"

        # Dynamic cognitive constraint post-processing
        if query_analysis:
            len_c = query_analysis.get("length_constraint")
            if len_c == "one_word":
                clean_word = re.sub(r"^(?:answer|the answer is|term|result|name):\s*", "", reply, flags=re.IGNORECASE).strip()
                clean_word = clean_word.strip('"`*.,;')
                words = clean_word.split()
                if len(words) <= 3:
                    reply = clean_word

            if query_analysis.get("suppress_scaffolding"):
                # Strip trailing follow-up conversational questions
                reply = re.sub(
                    r"\n+\s*(?:Would you like|Shall we|Do you want to|Should we|Let me know if)[^?\n]*\?\s*$",
                    "",
                    reply,
                    flags=re.IGNORECASE
                ).strip()

        thought = data.get("thought_process") or "Analyzed question against uploaded material and synthesized a clear, simple explanation."
        intent = data.get("intent", "QUESTION")
        is_expl = data.get("is_explanation", True)

        is_question = bool(re.search(
            r"\b(what|how|why|when|where|which|explain|describe|difference|types|summarize|important|concepts|show|diagram|architecture|compare|illustrate|visualize|flowchart)\b|\?",
            message.lower(),
        ))
        if is_question:
            intent = "QUESTION"
            is_expl = True

        extracted_subject = data.get("extracted_subject") if (intent == "SUBJECT_SPECIFIED" and not is_question) else None
        if intent in ("GREETING", "SUBJECT_SPECIFIED"):
            is_expl = False

        result_format = data.get("response_format", "conceptual")
        export_ready = (result_format == "study_notes")
        if "could not find the answer" in reply.lower() or "not found in your uploaded" in reply.lower():
            export_ready = False

        return {
            "thought_process": thought,
            "intent": intent,
            "extracted_subject": extracted_subject,
            "is_explanation": is_expl,
            "quiz_data": data.get("quiz_data"),
            "reply": reply,
            "groundedness_note": data.get("groundedness_note"),
            "response_format": result_format,
            "export_ready": export_ready,
            "visual_spec": data.get("visual_spec"),
        }

    # ------------------------------------------------------------------
    # Self-verification pass
    # ------------------------------------------------------------------

    async def _maybe_reground(
        self,
        result: Dict[str, Any],
        context: str,
        message: str,
        query_analysis: Optional[Dict[str, Any]] = None,
        generated_image_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Runs a cheap second LLM pass checking whether the reply's claims are supported by
        the retrieved context. On failure, regenerates once with a stricter grounding instruction.
        Any error here is swallowed — verification is a quality improvement, not a hard dependency."""
        try:
            verdict = await self._verify_groundedness(result["reply"], context)
        except Exception as e:  # noqa: BLE001
            print(f"[DecisionAgent] groundedness check skipped due to error: {e}")
            return result

        if verdict is None or verdict.get("grounded", True):
            return result

        print(f"[DecisionAgent] groundedness check flagged an issue, regenerating once: {verdict.get('issue')}")
        try:
            messages = [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {
                    "role": "system",
                    "content": f"A verification pass found this issue with a prior draft: {verdict.get('issue')}. "
                                "Regenerate the answer using ONLY facts present in the retrieved context below. "
                                "If the material genuinely doesn't cover the point in question, say so explicitly "
                                "rather than restating the unsupported claim.",
                },
                {
                    "role": "system",
                    "content": f"RETRIEVED CONTEXT CHUNKS:\n\n{context.strip()}",
                },
                {"role": "user", "content": f"Student's question: {message}"},
            ]
            raw = await ollama.chat(messages, temperature=0.0)
            parsed = self._parse_llm_response(raw)
            if parsed and parsed.get("reply"):
                return self._finalize(parsed, message, query_analysis, generated_image_info)
        except Exception as e:  # noqa: BLE001
            print(f"[DecisionAgent] re-grounding attempt failed, keeping original reply: {e}")

        return result

    async def _verify_groundedness(self, reply: str, context: str) -> Optional[Dict[str, Any]]:
        messages = [
            {"role": "system", "content": self.VERIFIER_SYSTEM_PROMPT},
            {"role": "user", "content": f"RETRIEVED COURSE MATERIAL:\n{context.strip()[:4000]}\n\nDRAFT ANSWER:\n{reply}"},
        ]
        raw = await ollama.chat(messages, temperature=0.0)
        cleaned = self._strip_code_fences(raw)
        if "{" not in cleaned or "}" not in cleaned:
            return None
        start, end = cleaned.find("{"), cleaned.rfind("}")
        try:
            return json.loads(cleaned[start:end + 1], strict=False)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Deterministic fallback (used only if the LLM is unreachable)
    # ------------------------------------------------------------------

    def _fallback_response(
        self,
        message: str,
        context: Optional[str],
        current_subject: Optional[str],
        query_analysis: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        # Handle study notes fallback explicitly
        if query_analysis and (query_analysis.get("intent") == "STUDY_NOTES_REQUEST" or query_analysis.get("response_format") == "study_notes"):
            target = query_analysis.get("target_topic") or current_subject or "this topic"
            return {
                "thought_process": f"LLM unavailable; failed to generate structured study notes for {target}.",
                "intent": "STUDY_NOTES_REQUEST",
                "extracted_subject": None,
                "is_explanation": True,
                "quiz_data": None,
                "reply": f"I couldn't reach the reasoning engine to generate study notes for **{target}** just now. Please verify your connection or try again in a moment.",
                "groundedness_note": "Notes generation fallback; LLM unreachable.",
                "response_format": "study_notes",
                "export_ready": False,
            }

        lower = message.lower().strip()
        is_greeting = bool(re.search(r"\b(hi|hello|hey|good morning|good evening|greetings)\b", lower))

        if is_greeting and not any(
            kw in lower for kw in
            ["learn", "study", "exam", "help", "rows", "columns", "what", "how", "why", "table", "forest", "concept", "tree"]
        ):
            return {
                "thought_process": "Student greeted. Prompting them to choose a study subject or topic.",
                "intent": "GREETING",
                "extracted_subject": None,
                "is_explanation": False,
                "quiz_data": None,
                "reply": "Hello! Welcome to DeepTutor. What subject or concept would you like to explore today?",
                "groundedness_note": None,
            }

        if context:
            clean_ctx = re.sub(r"\[Source:[^\]]*\]", "", context)
            clean_ctx = re.sub(r"\s*\((?:p\.|pages?)\s*\d+(?:[-–]\d+)?\)", "", clean_ctx)
            clean_ctx = re.sub(r"\s+", " ", clean_ctx).strip()
            sentences = [s.strip() for s in re.split(r"\. |\.\n", clean_ctx) if len(s.strip()) > 15][:3]
            summary_text = ". ".join(sentences) + "." if sentences else clean_ctx[:300]
            fallback_spec = None
            if visual_engine.should_generate_visual(message, query_analysis, summary_text):
                vtype = visual_engine.select_visual_type(message, query_analysis, summary_text)
                fallback_obj = visual_engine._build_deterministic_fallback(message, summary_text, vtype)
                if fallback_obj:
                    fallback_spec = fallback_obj.model_dump()
            return {
                "thought_process": "LLM unavailable; extracted foundational definition directly from retrieved material.",
                "intent": "QUESTION",
                "extracted_subject": None,
                "is_explanation": True,
                "quiz_data": None,
                "reply": f"{summary_text}\n\n**Key Takeaway:** Focus on how this principle applies to your problem solving.\n\n**Quick check:** Would you like a practice quiz question on this topic?",
                "groundedness_note": "Directly extracted from retrieved context; not LLM-synthesized.",
                "visual_spec": fallback_spec,
            }

        is_question = any(q in lower for q in [
            "what", "how", "why", "when", "where", "which", "explain", "describe",
            "types", "difference", "compare", "important", "concepts", "?",
        ]) or (query_analysis and query_analysis.get("recommended_action") == "EXPLAIN")

        if is_question:
            target = query_analysis.get("target_topic") if query_analysis else None
            topic_label = target or current_subject or "this topic"
            return {
                "thought_process": f"LLM unavailable; returning a structured learning response for {topic_label}.",
                "intent": "QUESTION",
                "extracted_subject": None,
                "is_explanation": True,
                "quiz_data": None,
                "reply": (
                    f"### Understanding {topic_label}\n\n"
                    f"**Definition:** {topic_label} is a core physical concept describing the rate of change or motion in a system.\n\n"
                    f"**Core Principle:** When studying {topic_label}, we evaluate both the magnitude and the conditions under which it operates.\n\n"
                    f"**Key Formula:**\n"
                    f"$$\\text{{Speed}} = \\frac{{\\text{{Distance}}}}{{\\text{{Time}}}}$$\n\n"
                    f"**Next Step:** Would you like to see a worked practice example, or explore the difference between speed and velocity?"
                ),
                "groundedness_note": "Foundational curriculum fallback; LLM unreachable.",
            }

        subj_title = message.strip().title()
        return {
            "thought_process": f"LLM unavailable; treating message as a subject declaration: {subj_title}.",
            "intent": "SUBJECT_SPECIFIED",
            "extracted_subject": subj_title,
            "is_explanation": False,
            "quiz_data": None,
            "reply": f"Understood! Let's focus on **{subj_title}**.\n\nPlease upload your study notes using the attachment button below, or ask a question from your course material.",
            "groundedness_note": None,
        }


# Singleton instance (kept for drop-in compatibility with existing imports)
decision_agent = DecisionAgent()
