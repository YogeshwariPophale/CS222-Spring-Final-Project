const DEFAULT_REQUIREMENTS = `Proposal must include:
- Project title
- Abstract
- Motivation and gap
- Project goal
- Method or agent workflow
- Figure or diagram with caption
- Expected results
- Research milestones with timeline estimates
- Evaluation plan
- Risks and mitigation
- Resources or budget
- References, assumptions, or source notes`;

const FIELD_LABELS = {
  title: 'Project Title',
  topic: 'Topic',
  problem: 'Problem',
  method: 'Method',
  timeline: 'Timeline',
  evaluation: 'Evaluation',
  resources: 'Resources',
  references: 'Sources'
};

const PROJECT_FIELDS = ['problem', 'method', 'evaluation', 'timeline', 'resources', 'references'];

export async function startAgentSession(payload = {}) {
  const topic = clean(payload.topic);
  const requirements = clean(payload.requirements) || DEFAULT_REQUIREMENTS;
  const project = buildProjectFromTopic(topic, requirements);

  return {
    mode: 'local-fallback',
    provider: 'template',
    project,
    fieldSuggestions: buildFieldSuggestions(project),
    decisions: buildDecisions(project),
    questions: buildQuestions(project),
    runMessage: 'Local proposal agent structured the rough idea into editable proposal fields.'
  };
}

export async function answerAgentQuestion(payload = {}) {
  const project = normalizeProject(payload.project || {});
  const answer = clean(payload.answer);
  const question = payload.question || {};
  const field = PROJECT_FIELDS.includes(question.field) ? question.field : 'method';
  const label = FIELD_LABELS[field] || 'Field';
  const mergedValue = mergeSentences(project[field], answer);
  const nextProject = normalizeProject({ ...project, [field]: mergedValue });

  return {
    mode: 'local-fallback',
    provider: 'template',
    project: nextProject,
    fieldSuggestions: buildFieldSuggestions(nextProject).filter((suggestion) => !nextProject[suggestion.field]),
    decisions: buildDecisions(nextProject),
    questions: buildQuestions(nextProject),
    runMessage: `Integrated the note into ${label}.`
  };
}

export async function generateProposal(payload = {}) {
  const project = normalizeProject(payload);
  const requirements = clean(payload.requirements) || DEFAULT_REQUIREMENTS;
  const proposalLatex = buildProposalLatex(project);
  const complianceMatrix = buildComplianceMatrix(project, requirements);
  const evaluationReport = buildEvaluationReport(project, complianceMatrix);

  return {
    mode: 'local-fallback',
    provider: 'template',
    proposalLatex,
    complianceMatrix,
    evaluationReport,
    questions: buildQuestions(project)
  };
}

function buildProjectFromTopic(topic, requirements) {
  const safeTopic = topic || 'Research proposal agent workflow';
  const title = titleCase(safeTopic);

  return normalizeProject({
    title,
    topic: safeTopic,
    problem: `Students and researchers often begin with a rough idea about ${safeTopic}, but they may miss the proposal gap, evaluation plan, risks, and source-grounding details expected in a strong research proposal.`,
    method: `Build a human-in-the-loop proposal agent that extracts structured fields from the rough idea, lets the student accept or edit suggestions, assembles an editable project state, and generates proposal artifacts for review.`,
    evaluation: `Evaluate the workflow by checking proposal completeness against the requirements, reviewing citation/source notes, and comparing the generated draft against a rubric for clarity, feasibility, novelty, and evaluation strength.`,
    timeline: `Phase 1: prototype the workflow and record a short demo. Phase 2: refine source grounding and revision loops. Phase 3: produce the final proposal PDF and supporting evidence.`,
    resources: `Local React/Vite app, Express API, generated LaTeX/PDF artifacts, proposal-writing guidance, source notes, and manual researcher review.`,
    references: `Use proposal-writing guidance, course feedback, source notes from seed papers, and relevant literature discovered through careful citation review.`,
    requirements
  });
}

function normalizeProject(project = {}) {
  const topic = clean(project.topic || project.title);
  return {
    title: clean(project.title) || titleCase(topic || 'Research proposal agent workflow'),
    topic: topic || clean(project.title) || 'Research proposal agent workflow',
    problem: clean(project.problem),
    method: clean(project.method),
    timeline: clean(project.timeline),
    evaluation: clean(project.evaluation),
    resources: clean(project.resources),
    references: clean(project.references),
    requirements: clean(project.requirements) || DEFAULT_REQUIREMENTS
  };
}

function buildFieldSuggestions(project) {
  const suggestions = [
    {
      field: 'problem',
      label: 'Problem',
      value: project.problem || `Clarify the research gap and why the topic "${project.topic}" needs a better workflow or method.`,
      reason: 'A proposal needs a clear motivation and gap.',
      confidence: 'High'
    },
    {
      field: 'method',
      label: 'Method',
      value: project.method || 'Describe the agent workflow, student checkpoints, artifact generation, and revision loop.',
      reason: 'The method explains how the proposed system works.',
      confidence: 'High'
    },
    {
      field: 'evaluation',
      label: 'Evaluation',
      value: project.evaluation || 'Evaluate draft quality with a requirement matrix, reviewer rubric, and before/after revision evidence.',
      reason: 'The evaluator needs measurable evidence of success.',
      confidence: 'Medium'
    },
    {
      field: 'timeline',
      label: 'Timeline',
      value: project.timeline || 'Prototype, test, revise, and prepare final proposal artifacts across staged milestones.',
      reason: 'A timeline makes the project feasible and concrete.',
      confidence: 'Medium'
    },
    {
      field: 'resources',
      label: 'Resources',
      value: project.resources || 'List the app, API, source notes, proposal examples, and human review time required.',
      reason: 'Resource planning shows feasibility.',
      confidence: 'Medium'
    },
    {
      field: 'references',
      label: 'Sources',
      value: project.references || 'Track seed papers, proposal guides, course feedback, and citation notes used for grounding.',
      reason: 'Source notes make the proposal more credible.',
      confidence: 'Medium'
    }
  ];

  return suggestions;
}

function buildDecisions(project) {
  return [
    {
      id: 'scope-decision',
      field: 'method',
      title: 'Choose workflow scope',
      question: 'What should the first working demo emphasize?',
      options: [
        {
          label: 'Proposal structure',
          value: mergeSentences(project.method, 'The first demo emphasizes turning a rough idea into accepted proposal fields and draft artifacts.'),
          rationale: 'Best for Phase 1 because it is easy to show in a short video.'
        },
        {
          label: 'Source grounding',
          value: mergeSentences(project.method, 'The first demo emphasizes reviewing source notes and citation-grounded claims before drafting.'),
          rationale: 'Best if the project focuses on literature review quality.'
        }
      ]
    },
    {
      id: 'evaluation-decision',
      field: 'evaluation',
      title: 'Choose evaluation evidence',
      question: 'What evidence should show that the workflow improves the proposal?',
      options: [
        {
          label: 'Checklist matrix',
          value: mergeSentences(project.evaluation, 'Use a checklist matrix to show which required proposal sections are covered and which need revision.'),
          rationale: 'Simple and clear for a class demo.'
        },
        {
          label: 'Revision comparison',
          value: mergeSentences(project.evaluation, 'Compare an initial rough draft against the final revised proposal to show improvement.'),
          rationale: 'Shows the value of iteration.'
        }
      ]
    }
  ];
}

function buildQuestions(project) {
  const questions = [];
  if (!project.references) {
    questions.push({
      field: 'references',
      question: 'What papers, proposal guides, or course feedback should be cited or summarized?',
      reason: 'Source notes improve grounding.',
      priority: 'Medium'
    });
  }
  if (!project.evaluation) {
    questions.push({
      field: 'evaluation',
      question: 'How will you measure whether the proposal workflow is successful?',
      reason: 'Evaluation is required for a strong proposal.',
      priority: 'High'
    });
  }
  return questions;
}

function buildProposalLatex(project) {
  const title = latexEscape(project.title || 'Research Proposal Agent Workflow');
  return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\setlist{nosep}
\title{${title}}
\author{}
\date{}
\begin{document}
\maketitle

\begin{abstract}
This proposal describes ${latexEscape(project.topic)}. The project builds and evaluates a workflow that turns a rough research idea into structured proposal state, draft artifacts, and review evidence.
\end{abstract}

\section{Motivation and Gap}
${latexParagraph(project.problem || 'The project needs a clearer research gap and motivation.')}

\section{Project Goal}
The goal is to create a proposal-agent workflow that helps a student or researcher move from idea exploration to a structured, reviewable proposal draft.

\section{Method and Agent Workflow}
${latexParagraph(project.method || 'The workflow extracts fields, asks for decisions, stores accepted project state, drafts artifacts, and supports review.')}

\section{Workflow Diagram}
\begin{center}
\fbox{\begin{minipage}{0.88\linewidth}
\centering
Rough idea $\rightarrow$ structured fields $\rightarrow$ student decisions $\rightarrow$ proposal draft $\rightarrow$ review matrix $\rightarrow$ revised PDF
\end{minipage}}
\end{center}

\section{Expected Results}
The expected result is a working prototype that produces a coherent proposal draft, a compliance matrix, and a PDF artifact suitable for review and refinement.

\section{Timeline and Milestones}
${latexParagraph(project.timeline || 'The work proceeds through prototype, refinement, evaluation, and final proposal preparation milestones.')}

\section{Evaluation Plan}
${latexParagraph(project.evaluation || 'The proposal will be evaluated with a checklist matrix, reviewer feedback, and revision evidence.')}

\section{Risks and Mitigation}
\begin{itemize}
\item \textbf{Risk:} Generated text may be incomplete. \textbf{Mitigation:} Keep fields editable and use a requirement matrix.
\item \textbf{Risk:} Related work may be weak. \textbf{Mitigation:} Require explicit source notes and manual review.
\item \textbf{Risk:} PDF compilation may fail locally. \textbf{Mitigation:} Use the built-in fallback PDF renderer.
\end{itemize}

\section{Resources and Budget}
${latexParagraph(project.resources || 'The project uses a local web app, API server, source notes, and human review time.')}

\section{References and Source Notes}
${latexParagraph(project.references || 'Add proposal guides, seed papers, citation notes, and course feedback here.')}

\end{document}`;
}

function buildComplianceMatrix(project, requirements) {
  const requirementLines = clean(requirements)
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !/^proposal must include/i.test(line));

  return requirementLines.map((requirement) => {
    const evidence = evidenceForRequirement(requirement, project);
    return {
      requirement,
      status: evidence ? 'Covered' : 'Needs work',
      evidence: evidence || 'No matching project field was found yet.',
      fix: evidence ? 'Review for specificity and citations.' : `Add details for: ${requirement}`
    };
  });
}

function evidenceForRequirement(requirement, project) {
  const text = requirement.toLowerCase();
  if (/title/.test(text)) return project.title;
  if (/abstract/.test(text)) return project.topic;
  if (/motivation|gap|problem/.test(text)) return project.problem;
  if (/goal/.test(text)) return project.topic || project.problem;
  if (/method|workflow|agent/.test(text)) return project.method;
  if (/figure|diagram/.test(text)) return 'Workflow diagram placeholder is generated in LaTeX.';
  if (/expected|result/.test(text)) return project.method || project.evaluation;
  if (/milestone|timeline/.test(text)) return project.timeline;
  if (/evaluation/.test(text)) return project.evaluation;
  if (/risk|mitigation/.test(text)) return 'Risks and mitigation are generated in the proposal template.';
  if (/resource|budget/.test(text)) return project.resources;
  if (/reference|assumption|source/.test(text)) return project.references;
  return '';
}

function buildEvaluationReport(project, matrix) {
  const covered = matrix.filter((row) => /^covered$/i.test(row.status)).length;
  const total = matrix.length || 1;
  const percent = Math.round((covered / total) * 100);

  return `Proposal Review\n\nCoverage: ${covered}/${total} (${percent}%).\n\nStrengths:\n- The draft includes a structured project state and generated artifacts.\n- The workflow keeps fields editable for student review.\n\nRecommended next steps:\n- Add more specific citations and source notes.\n- Strengthen the evaluation metrics.\n- Review the timeline for feasibility.\n- Revise the PDF after instructor or peer feedback.\n\nCurrent title: ${project.title}`;
}

function clean(value) {
  return String(value || '').trim();
}

function titleCase(value) {
  const text = clean(value);
  if (!text) return 'Research Proposal Agent Workflow';
  return text
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mergeSentences(current, addition) {
  const base = clean(current);
  const next = clean(addition);
  if (!base) return next;
  if (!next) return base;
  if (base.includes(next)) return base;
  return `${base} ${next}`;
}

function latexParagraph(value) {
  return latexEscape(value || '').replace(/\n{2,}/g, '\n\n');
}

function latexEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}
}
