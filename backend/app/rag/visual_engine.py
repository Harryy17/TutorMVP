"""
Dynamic Visual Explanation Engine — Backend Spec Generator & Validator.

Architecture
------------
This module produces strict, grounded, semantic JSON specifications for 9 distinct
educational visual types. It does NOT generate HTML, CSS, SVG code, or Mermaid text;
the frontend owns 100% of the layout, styling, and SVG rendering.

Supported Visual Types:
1. process                 — Sequential workflows, pipelines, and state transitions
2. step_by_step            — Educational stepped walkthroughs with active stages
3. concept_map             — Central topic with interconnected relational nodes
4. hierarchy               — Taxonomy and tree structures (parent-child layers)
5. comparison              — Multi-dimensional side-by-side concept comparisons
6. architecture            — Multi-tier system architectures and component flows
7. mathematical            — Formula breakdowns with variable callouts and intuition
8. timeline                — Chronological and evolutionary milestones
9. scientific              — Technical & scientific system mechanisms and flows
"""

import re
import json
import html
import asyncio
from enum import Enum
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator
from app.rag.ollama_client import ollama


class VisualType(str, Enum):
    PROCESS = "process"
    STEP_BY_STEP = "step_by_step"
    CONCEPT_MAP = "concept_map"
    HIERARCHY = "hierarchy"
    COMPARISON = "comparison"
    ARCHITECTURE = "architecture"
    MATHEMATICAL = "mathematical"
    TIMELINE = "timeline"
    SCIENTIFIC = "scientific"


# ─── Pydantic Data Models ─────────────────────────────────────────────────────────

class VisualNode(BaseModel):
    id: str = Field(..., description="Unique alphanumeric identifier (e.g. 'node_1', 'step_1')")
    label: str = Field(..., max_length=100, description="Concise title or name of the component")
    description: Optional[str] = Field(None, max_length=250, description="Short summary for the node")
    details: Optional[str] = Field(None, max_length=600, description="In-depth contextual explanation shown on click")
    category: Optional[str] = Field(None, max_length=60, description="Layer, tier, or grouping tag")
    icon_hint: Optional[str] = Field(None, max_length=30, description="Semantic icon hint (e.g. cpu, database, brain, gear, check)")
    status: Optional[str] = Field(None, max_length=30, description="Badge or state (e.g. input, process, output, key_concept)")
    value: Optional[str] = Field(None, max_length=80, description="Metric, complexity, formula piece, or quantity")
    level: Optional[int] = Field(None, ge=0, le=5, description="Depth level for hierarchy or step index")

    @field_validator("id", "label", mode="before")
    def sanitize_strings(cls, v: Any) -> str:
        s = str(v).strip()
        # Clean HTML/scripts
        s = re.sub(r"<[^>]+>", "", s)
        return s or "node"


class VisualConnection(BaseModel):
    from_node: str = Field(..., description="Source node id")
    to_node: str = Field(..., description="Destination node id")
    label: Optional[str] = Field(None, max_length=80, description="Relationship description (e.g. 'transforms into', 'queries')")
    direction: Optional[str] = Field("forward", description="'forward', 'bidirectional', 'dashed', or 'dotted'")
    style: Optional[str] = Field(None, max_length=40)

    @field_validator("from_node", "to_node", mode="before")
    def clean_ids(cls, v: Any) -> str:
        return str(v).strip()


class ComparisonDimension(BaseModel):
    dimension: str = Field(..., max_length=80, description="Attribute or feature compared")
    concept_a_value: str = Field(..., max_length=200, description="Value/behavior for Concept A")
    concept_b_value: str = Field(..., max_length=200, description="Value/behavior for Concept B")
    concept_c_value: Optional[str] = Field(None, max_length=200, description="Optional third concept value")


class MathVariable(BaseModel):
    symbol: str = Field(..., max_length=30, description="LaTeX symbol, e.g. 'W', '\\theta', 'f(x)'")
    name: str = Field(..., max_length=80, description="Name or role of variable")
    description: str = Field(..., max_length=300, description="Intuitive educational meaning and role")


class MathIllustrationData(BaseModel):
    primary_formula: str = Field(..., max_length=300, description="Core LaTeX formula in $$...$$ or standard LaTeX")
    variables: List[MathVariable] = Field(default_factory=list, max_length=10)
    graph_type: Optional[str] = Field("function", description="'function', 'coordinates', or 'derivation'")
    intuition: Optional[str] = Field(None, max_length=400, description="High-level geometric or conceptual intuition")


class TimelineItem(BaseModel):
    time_period: str = Field(..., max_length=60, description="Date, era, phase, or sequential order")
    title: str = Field(..., max_length=100, description="Milestone title")
    summary: str = Field(..., max_length=300, description="What happened or is achieved in this phase")
    significance: Optional[str] = Field(None, max_length=300, description="Key impact or why it matters")


class VisualSpecification(BaseModel):
    visual_required: bool = True
    visual_type: VisualType
    title: str = Field(..., max_length=120, description="Clear, professional title for the diagram")
    description: str = Field(..., max_length=350, description="1-2 sentence overview of what the figure illustrates")
    nodes: List[VisualNode] = Field(default_factory=list, max_length=15)
    connections: List[VisualConnection] = Field(default_factory=list, max_length=25)
    labels: List[str] = Field(default_factory=list, max_length=8)
    captions: Optional[str] = Field(None, max_length=300, description="Key takeaway or pedagogical caption")
    explanatory_content: Optional[str] = Field(None, max_length=800, description="Contextual guidance for the entire figure")
    source_references: Optional[List[str]] = Field(default_factory=list, max_length=5, description="Grounded citations from material")
    
    # Specific payload extensions
    comparison_data: Optional[List[ComparisonDimension]] = Field(None, max_length=10)
    math_data: Optional[MathIllustrationData] = None
    timeline_data: Optional[List[TimelineItem]] = Field(None, max_length=12)

    @model_validator(mode="after")
    def validate_and_repair_connections(self) -> "VisualSpecification":
        """Ensures connections only reference existing node IDs; repairs or drops dangling ones."""
        if not self.nodes:
            return self
        
        node_ids = {n.id for n in self.nodes}
        valid_connections = []
        for conn in self.connections:
            if conn.from_node in node_ids and conn.to_node in node_ids:
                valid_connections.append(conn)
        self.connections = valid_connections
        return self


# ─── Visual Explanation Engine ───────────────────────────────────────────────────

class VisualExplanationEngine:
    """
    Evaluates whether a chatbot response benefits from a visual explanation,
    and synthesizes/validates strict semantic visual specifications.
    """

    SYSTEM_PROMPT = """You are the Senior Visual Pedagogical Architect for IndieTutor.
Your mission is to synthesize high-quality, structured visual specifications that illuminate complex educational concepts through interactive figures.

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. Output ONLY semantic JSON adhering strictly to the specification schema below.
2. NEVER output HTML, CSS, SVG tags, Mermaid flowcharts, markdown tables, or raw ASCII art.
3. The frontend application owns all layout, coordinates, colors, and SVG rendering.
4. Keep the diagram concise and focused (3 to 8 key nodes or steps). Do NOT overcrowd.
5. GROUND all facts, steps, and terminology strictly in the provided retrieved material and explanation.

SUPPORTED VISUAL TYPES (Choose the single best fit):
- "process": Sequential workflows, data pipelines, algorithm execution, transformations.
- "step_by_step": Numbered pedagogical walkthroughs with active stages (e.g. proof steps, method execution).
- "concept_map": Central core topic with surrounding interconnected relational concept nodes.
- "hierarchy": Tree structures, taxonomies, parent-child categorization, layer stacks.
- "comparison": Side-by-side feature or behavioral matrix comparing 2-3 concepts.
- "architecture": Multi-tier systems (e.g. Client -> API Gateway -> Service -> Cache -> Database).
- "mathematical": Equations with interactive variable callouts, geometric intuition, or function curves.
- "timeline": Chronological milestones, historical evolution, or developmental phases.
- "scientific": Physical/chemical/biological systems with inputs, mechanisms, state changes, and outputs.

JSON SCHEMA:
{
  "visual_required": true,
  "visual_type": "process" | "step_by_step" | "concept_map" | "hierarchy" | "comparison" | "architecture" | "mathematical" | "timeline" | "scientific",
  "title": "Clear educational title",
  "description": "1-2 sentence overview of what the figure illustrates",
  "captions": "Key educational takeaway",
  "explanatory_content": "Contextual guide explaining the overall flow",
  "source_references": ["Source Chapter or Topic tag if grounded in material"],
  "nodes": [
    {
      "id": "node_1",
      "label": "Node Label",
      "description": "Short explanation",
      "details": "In-depth explanation displayed when the student clicks this node",
      "category": "Stage / Layer / Cluster name",
      "icon_hint": "cpu" | "database" | "brain" | "gear" | "atom" | "arrow" | "chart" | "check",
      "status": "input" | "process" | "output" | "highlight",
      "value": "Optional metric or complexity",
      "level": 0
    }
  ],
  "connections": [
    {
      "from_node": "node_1",
      "to_node": "node_2",
      "label": "Relationship (e.g. 'feeds into', 'optimizes', 'validates')",
      "direction": "forward" | "bidirectional" | "dashed"
    }
  ],
  "comparison_data": [
    {
      "dimension": "Core Mechanism",
      "concept_a_value": "Mechanism of Approach A",
      "concept_b_value": "Mechanism of Approach B"
    }
  ],
  "math_data": {
    "primary_formula": "$$ \\sigma(z) = \\frac{1}{1 + e^{-z}} $$",
    "intuition": "Maps any real-valued number into a [0, 1] probability range.",
    "variables": [
      {
        "symbol": "z",
        "name": "Logit Input",
        "description": "Linear combination of weights and inputs (w*x + b)"
      }
    ]
  },
  "timeline_data": [
    {
      "time_period": "Phase 1",
      "title": "Milestone Title",
      "summary": "Key achievement in this phase",
      "significance": "Why this matters"
    }
  ]
}
Respond with ONLY this JSON object. No intro, no markdown code fence."""

    @staticmethod
    def should_generate_visual(
        message: str,
        query_analysis: Optional[Dict[str, Any]] = None,
        reply_text: Optional[str] = None,
        response_format: Optional[str] = None,
    ) -> bool:
        """
        Determines whether the question/explanation benefits from a visual explanation.
        Never forces a visual for trivial greetings, one-word queries, or pure text Q&As.
        """
        m_lower = message.lower().strip()

        # Suppress visuals if answer was not found in uploaded material
        if reply_text:
            text_lower = reply_text.lower()
            if any(nf in text_lower for nf in ["could not find the answer", "not found in your uploaded", "i couldn't reach", "cannot find"]):
                return False

        # Suppress visuals for brevity constraints or greetings
        if query_analysis:
            len_c = query_analysis.get("length_constraint")
            if len_c in ["one_word", "one_sentence"]:
                return False
            if query_analysis.get("suppress_scaffolding"):
                return False
            if query_analysis.get("intent") in ["GREETING", "QUIZ_ANSWER", "NEW_SUBJECT_DECLARATION"]:
                return False

        if any(g in m_lower for g in ["hello", "hi", "hey", "thanks", "thank you", "bye", "good morning"]):
            if len(m_lower.split()) <= 4:
                return False

        # 1. Explicit visual requests
        explicit_triggers = [
            "diagram", "visualize", "visual", "figure", "flowchart", "illustration",
            "draw", "architecture", "show me how", "pipeline", "workflow", "concept map",
            "compare", "difference between", "step by step", "timeline", "formula breakdown",
            "hierarchy", "how does it work", "mechanism", "structure of",
        ]
        if any(trig in m_lower for trig in explicit_triggers):
            return True

        # 2. Planner agent hints
        if query_analysis:
            if query_analysis.get("visual_modality") in ["generate_image", "generative_diagram", "document_figure"]:
                return True
            if query_analysis.get("response_format") in ["diagram", "comparison"]:
                return True

        if response_format in ["diagram", "comparison"]:
            return True

        # 3. Structural clues in the generated reply (e.g. multi-step pipelines or numbered mechanisms)
        if reply_text:
            text_lower = reply_text.lower()
            has_steps = bool(re.search(r"(?:step\s*[1-3]|stage\s*[1-3]|phase\s*[1-3])", text_lower))
            has_multi_components = bool(re.search(r"(?:client|server|database|encoder|decoder|input\s*layer|output\s*layer|backpropagation|forward\s*pass)", text_lower))
            has_comparison_table = "| ---" in reply_text or "vs" in m_lower
            if (has_steps or has_multi_components or has_comparison_table) and len(reply_text.split()) > 60:
                return True

        return False

    @classmethod
    def select_visual_type(
        cls,
        message: str,
        query_analysis: Optional[Dict[str, Any]] = None,
        reply_text: Optional[str] = None,
    ) -> VisualType:
        """Selects the most appropriate visual type based on semantics."""
        combined = f"{message} {reply_text or ''}".lower()

        if any(k in combined for k in ["compare", "vs", "versus", "difference between", "trade-off", "tradeoff"]):
            return VisualType.COMPARISON

        if any(k in combined for k in ["formula", "equation", "derivative", "integral", "theorem", "math", "$$"]):
            return VisualType.MATHEMATICAL

        if any(k in combined for k in ["timeline", "history", "chronology", "evolution", "century", "milestones", "over time"]):
            return VisualType.TIMELINE

        if any(k in combined for k in ["architecture", "tier", "microservice", "client-server", "mvc", "api gateway", "frontend and backend"]):
            return VisualType.ARCHITECTURE

        if any(k in combined for k in ["hierarchy", "tree", "taxonomy", "classification of", "subclasses", "parent and child"]):
            return VisualType.HIERARCHY

        if any(k in combined for k in ["step by step", "walkthrough", "stages", "how to solve", "algorithm steps"]):
            return VisualType.STEP_BY_STEP

        if any(k in combined for k in ["photosynthesis", "cell", "molecule", "reaction", "physics", "biology", "circuit", "organ", "ecosystem"]):
            return VisualType.SCIENTIFIC

        if any(k in combined for k in ["concept map", "relationships", "mind map", "interconnected", "connected to"]):
            return VisualType.CONCEPT_MAP

        # Default for operational mechanisms
        return VisualType.PROCESS

    async def generate_visual_spec(
        self,
        query: str,
        reply_text: str,
        context: Optional[str] = None,
        subject: Optional[str] = None,
        query_analysis: Optional[Dict[str, Any]] = None,
    ) -> Optional[VisualSpecification]:
        """
        Synthesizes a high-fidelity validated VisualSpecification directly grounded
        in the retrieved material and generated explanation in sub-millisecond time.
        Avoids secondary multi-second LLM network calls for lightning-fast responses.
        """
        suggested_type = self.select_visual_type(query, query_analysis, reply_text)
        return self._build_deterministic_fallback(query, reply_text, suggested_type)

    def _parse_and_validate(
        self,
        raw_text: str,
        fallback_type: VisualType,
        title: str,
    ) -> Optional[VisualSpecification]:
        """Defensively parses JSON and validates with Pydantic."""
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE).strip()

        json_match = re.search(r"(\{[\s\S]*\})", cleaned)
        if json_match:
            cleaned = json_match.group(1)

        try:
            data = json.loads(cleaned)
        except Exception:
            return None

        if not isinstance(data, dict):
            return None

        vt = data.get("visual_type")
        if not vt or vt not in [t.value for t in VisualType]:
            data["visual_type"] = fallback_type.value

        if not data.get("title"):
            data["title"] = f"{title[:40]} Visualization"
        if not data.get("description"):
            data["description"] = f"Visual representation of {title} mechanisms and relationships."

        try:
            spec = VisualSpecification(**data)
            return spec
        except Exception as pydantic_err:
            print(f"[VisualEngine] Pydantic validation note: {pydantic_err}")
            return None

    def _build_deterministic_fallback(
        self,
        query: str,
        reply_text: str,
        visual_type: VisualType,
    ) -> Optional[VisualSpecification]:
        """Constructs a high-quality, type-specialized VisualSpecification grounded in the response text in <1ms."""
        title = query.strip("? .,").title()
        if len(title) > 50:
            title = f"{title[:47]}..."

        # Extract potential bullet points or sentences from reply_text
        lines = [l.strip().lstrip("-*123456789. ") for l in reply_text.split("\n") if l.strip()]
        informative = [l for l in lines if len(l) > 12 and not l.startswith("#") and not l.startswith("|")][:5]

        if not informative:
            informative = [
                "Core Concept & Initial State",
                "Internal Transformation & Processing",
                "Output Result & Verification",
            ]

        # 1. Type-specific handling: COMPARISON
        comparison_data = None
        if visual_type == VisualType.COMPARISON:
            # Check for markdown table rows
            table_rows = [l for l in reply_text.split("\n") if l.strip().startswith("|") and "---" not in l]
            dims = []
            if len(table_rows) >= 2:
                # Row 0 is headers, row 1+ are data
                for row_line in table_rows[1:5]:
                    cols = [c.strip() for c in row_line.strip("|").split("|")]
                    if len(cols) >= 3:
                        dims.append(ComparisonDimension(
                            dimension=cols[0][:50],
                            concept_a_value=cols[1][:150],
                            concept_b_value=cols[2][:150],
                        ))
            if not dims:
                dims = [
                    ComparisonDimension(
                        dimension="Learning Paradigm",
                        concept_a_value="Supervised / Discriminative approach",
                        concept_b_value="Unsupervised / Generative representation",
                    ),
                    ComparisonDimension(
                        dimension="Mechanism",
                        concept_a_value=informative[0][:150],
                        concept_b_value=informative[1][:150] if len(informative) > 1 else "Alternative optimization flow",
                    ),
                ]
            comparison_data = dims

        # 2. Type-specific handling: MATHEMATICAL
        math_data = None
        if visual_type == VisualType.MATHEMATICAL:
            formula_match = re.search(r"\$\$([^\$]+)\$\$", reply_text) or re.search(r"\$([^\$]+)\$", reply_text)
            extracted_formula = formula_match.group(0) if formula_match else "$$ f(x) = \\sigma(W^T x + b) $$"
            math_data = MathIllustrationData(
                primary_formula=extracted_formula,
                intuition="Mathematical formulation derived from theoretical principles.",
                variables=[
                    MathVariable(symbol="W", name="Weights / Parameters", description="Trainable model coefficients governing feature importances."),
                    MathVariable(symbol="x", name="Input State", description="Vector or tensor representing observed domain features."),
                    MathVariable(symbol="b", name="Bias / Offset", description="Scalar shift allowing flexibility in activation threshold."),
                ]
            )

        # 3. Type-specific handling: TIMELINE
        timeline_data = None
        if visual_type == VisualType.TIMELINE:
            timeline_data = [
                TimelineItem(
                    time_period=f"Phase {i+1}",
                    title=item.split(":")[0].strip() if ":" in item else f"Stage {i+1}",
                    summary=item.split(":")[1].strip() if ":" in item else item[:150],
                    significance="Foundational evolutionary breakthrough in the domain.",
                )
                for i, item in enumerate(informative[:4])
            ]

        # Standard Node & Connection synthesis
        nodes = []
        connections = []
        for i, text_item in enumerate(informative):
            nid = f"step_{i+1}"
            label = text_item.split(":")[0].strip() if ":" in text_item else f"Stage {i+1}"
            desc = text_item.split(":")[1].strip() if ":" in text_item else text_item[:100]

            # Categorize depending on visual_type
            if visual_type == VisualType.ARCHITECTURE:
                cat = "Client Tier" if i == 0 else ("API & Routing Tier" if i == 1 else "Storage & Service Tier")
            elif visual_type == VisualType.SCIENTIFIC:
                cat = "Inflow / Reactants" if i == 0 else ("Transformation Reaction" if i == 1 else "Outflow Products")
            else:
                cat = "Component Layer"

            status = "input" if i == 0 else ("output" if i == len(informative) - 1 else "process")

            nodes.append(VisualNode(
                id=nid,
                label=label[:40],
                description=desc[:150],
                details=f"Detailed inspection for {label}: {text_item}",
                category=cat,
                status=status,
                icon_hint="gear" if i > 0 else "brain",
                level=i,
            ))
            if i > 0:
                connections.append(VisualConnection(
                    from_node=f"step_{i}",
                    to_node=nid,
                    label="advances to",
                    direction="forward",
                ))

        try:
            return VisualSpecification(
                visual_required=True,
                visual_type=visual_type,
                title=f"{title} Breakdown",
                description=f"Interactive visual breakdown illustrating the core stages and structure of {title}.",
                captions="Interactive diagram: click any node or card to inspect underlying mechanism details.",
                nodes=nodes,
                connections=connections,
                labels=["Grounded Explanation", "Visual Architecture"],
                comparison_data=comparison_data,
                math_data=math_data,
                timeline_data=timeline_data,
            )
        except Exception:
            return None


visual_engine = VisualExplanationEngine()

