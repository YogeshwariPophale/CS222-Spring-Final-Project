# Work Notes: Proposal Agent Phase 1 and Stage 2 Planning

This file keeps presentation notes, professor feedback, and follow-up tasks out of the production webpage. The app UI should stay ready-to-use for a student/researcher, while this document tracks design rationale and next steps.

## Current Ready-To-Use Workflow

1. Enter a rough research idea.
2. Let the agent structure the idea into proposal fields.
3. Accept, skip, or edit suggested content.
4. Upload reference-paper files or paste extracted notes.
5. Override generated content with researcher-provided material and instructions.
6. Choose a target language and optional translation/review engine.
7. Generate LaTeX, PDF, compliance matrix, and review artifacts.

## Professor Feedback To Preserve

- Related-work retrieval can become noisy if it only uses keyword search or broad semantic retrieval.
- A Connected Papers-style citation graph can improve grounding by starting from a trusted seed paper and exploring papers that cite it, are cited by it, or are closely related.
- The student/researcher should approve the ranked paper list before the agent uses those papers as retrieval or citation context.
- For Phase 1, it is acceptable to demonstrate the design with screenshots, ranked paper lists, and human checkpoints rather than building a full Connected Papers clone.

## Source-Grounding Loop For Stage 2

1. **Seed** — Start from one trusted PDF, title, DOI, or paper URL.
2. **Graph** — Use Connected Papers or a similar citation graph to inspect related, cited, and citing papers.
3. **Rank** — Prioritize influential or highly connected papers instead of retrieving everything.
4. **Verify** — Student rejects fishy, irrelevant, or weakly related papers.
5. **Retrieve** — Agent uses only accepted papers/notes for related work, novelty, and evaluation claims.

## Override And Translation Design Notes

- Researcher-provided material should have higher priority than generated suggestions.
- Override instructions should be treated as constraints, for example: “Do not invent citations,” “Use my evaluation plan exactly,” or “Replace generated related work with my notes.”
- Target language should be passed into the drafting prompt.
- The translation model/engine field is documentation by default, such as `DeepL` or `human review`.
- If an API-backed deployment intentionally wants to override the generation model, use the `api:model-name` prefix.

## 5-Minute Presentation Outline

| Time | Segment | Notes |
| --- | --- | --- |
| 0:00–0:30 | Motivation | Rough ideas often miss gap, evaluation, timeline, risks, and sources. |
| 0:30–1:30 | Prototype tour | Show rough idea input, suggestion cards, decision cards, editable project state, reference upload, language controls, and artifacts. |
| 1:30–2:45 | Example journey | Run sample topic, accept one field, upload/paste reference notes, add override material, set target language, and generate artifacts. |
| 2:45–3:35 | Workflow rationale | Explain extract → decide → source-ground → assemble/override → draft → review. |
| 3:35–4:25 | Professor feedback | Explain citation-graph grounding and human approval of ranked papers. |
| 4:25–5:00 | Stage 2 plan | Add graph screenshots, accepted-paper lists, stronger citation enforcement, transcripts, and revision history. |

## Stage 2 Follow-Up Checklist

- Save full run transcripts and screenshots as usage evidence.
- Add structured reference-paper extraction for PDFs, not just file metadata and pasted notes.
- Add a citation-graph evidence artifact with screenshots or ranked source lists.
- Add revision actions that convert compliance-matrix gaps into targeted follow-up questions.
- Add multilingual review evidence when target language is not English.
