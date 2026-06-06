# Stage 1 Demo Artifact: Research Proposal Agent Workflow

## Prototype Goal

This Phase 1 prototype demonstrates a human-in-the-loop proposal agent that turns a rough research idea into structured proposal state, lets the student accept or revise the agent's suggestions, and produces proposal artifacts that can be evaluated in later stages. After professor feedback, the design also includes a Connected Papers-style citation-graph grounding loop so related work can be based on a student-approved set of relevant papers rather than noisy keyword retrieval. The updated workflow also adds researcher override fields and language/translation controls so the student can interrupt generated content with their own material or request a specific proposal language.

## Workflow Stages

1. **Extract** — The student enters a rough idea. The agent expands it into proposal fields such as problem, method, evaluation, timeline, resources, and sources.
2. **Decide** — The agent presents suggestion cards and decision cards. The student accepts, skips, or edits recommendations instead of blindly trusting a generated draft.
3. **Ground Sources** — For topics based on an existing paper, the student starts with a seed PDF or title, explores related/cited/citing papers in a Connected Papers-style graph, and accepts only the most relevant high-impact papers for retrieval.
4. **Assemble and Override** — Accepted suggestions, accepted papers, researcher-provided notes, override instructions, target language, and optional translation model become the project state. The state remains editable so the student can interrupt, replace, or refine generated content before drafting.
5. **Draft** — The agent generates proposal artifacts, including LaTeX source and a PDF preview.
6. **Review** — The app surfaces a compliance matrix and review notes so missing proposal requirements can be revised before final submission.

## What the Agent Does Automatically

- Infers an initial proposal title and field-level content from a rough idea.
- Creates confidence-labeled suggestions and decision options.
- Integrates custom student notes into the project state.
- Drafts proposal artifacts from accepted state.
- Uses the accepted paper list as grounded context for related work, novelty, and evaluation claims.
- Preserves researcher-provided material and override instructions as higher-priority context than generated suggestions.
- Carries target-language and translation-model preferences into the drafting prompt or local fallback artifact.
- Builds review evidence through coverage and evaluation outputs.

## Where the Student Gives Feedback

- Chooses which suggestions to accept or skip.
- Selects among decision-card alternatives.
- Edits every accepted project-state field directly.
- Adds their own paper summaries, required claims, notes, constraints, or replacement text in researcher-material and override-instruction fields.
- Sets a target language and optional translation model/engine when the proposal should be drafted or reviewed multilingually.
- Adds extra notes when the cards miss important project context.
- Reviews citation-graph screenshots or ranked paper lists and rejects papers that look irrelevant or unreliable.
- Uses the review matrix to decide what to revise in Stage 2.

## External Research Sources for the Video

- **NSF Proposal & Award Policies and Procedures Guide** — informs required proposal sections, merit-review thinking, broader impacts, and documentation expectations: <https://www.nsf.gov/policies/pappg>
- **Purdue OWL Grant Writing Guide** — informs problem framing, objectives, methods, evaluation plans, and resource/budget logic: <https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/grant_writing/index.html>
- **Google PAIR People + AI Guidebook** — informs human-in-the-loop design, user control, confidence communication, and feedback collection: <https://pair.withgoogle.com/guidebook/>
- **Connected Papers** — inspires the Stage 2 source-grounding loop: start from a seed paper, inspect nearby influential papers, screenshot the graph, and let the student approve papers before retrieval: <https://www.connectedpapers.com/>

## 5-Minute Presentation Outline

| Time | Segment | What to Show |
| --- | --- | --- |
| 0:00–0:30 | Motivation | Explain that rough research ideas often lack gap, evaluation, timeline, and risk detail. |
| 0:30–1:30 | Prototype tour | Show rough-idea input, workflow stages, source cards, suggestion cards, decision cards, project state, and memory. |
| 1:30–2:45 | Example journey | Run the sample topic, accept one suggestion, add researcher material, set a target language if needed, and generate artifacts. |
| 2:45–3:35 | Workflow rationale | Explain why extract → decide → source grounding → assemble → draft → review should improve proposal quality. |
| 3:35–4:25 | Professor feedback | Show how a Connected Papers-style graph can rank relevant papers, reduce noisy related work, and give the student a human checkpoint. |
| 4:25–5:00 | Stage 2 plan | Describe graph screenshots, accepted-paper lists, stronger citation grounding, saved transcripts, revision history, and evaluator improvements. |

## Stage 2 Refinement Targets

- Store full run transcripts and screenshots as usage evidence.
- Add a citation-graph grounding pass: seed paper → related/cited/citing graph → ranked paper list → student approval → retrieval.
- Strengthen researcher override handling so user-provided material can replace generated text section by section.
- Add multilingual generation and translation review evidence, including the selected target language and model/engine.
- Add stronger reference/source-note enforcement before drafting.
- Add a revision loop that converts review-matrix gaps into targeted follow-up questions.
- Add clearer separation between course implementation tasks and the proposed research timeline.
