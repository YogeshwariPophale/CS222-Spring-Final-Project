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
  const references = buildIeeeReferences(project.references);
  return String.raw`\documentclass[conference]{IEEEtran}
\IEEEoverridecommandlockouts
\usepackage{cite}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{algorithmic}
\usepackage{graphicx}
\usepackage{textcomp}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\def\BibTeX{{\rm B\kern-.05em{\sc i\kern-.025em b}\kern-.08em
    T\kern-.1667em\lower.7ex\hbox{E}\kern-.125emX}}
\title{${title}}
\author{\IEEEauthorblockN{Proposal Draft}
\IEEEauthorblockA{\textit{Generated Research Proposal}\\
Local Proposal Agent Workflow}}
\begin{document}
\maketitle
\begin{abstract}
${latexParagraph(buildAbstract(project))}
\end{abstract}
\begin{IEEEkeywords}
research proposal, agent workflow, source grounding, evaluation, PDF generation
\end{IEEEkeywords}

\section{Introduction and Motivation}
${latexParagraph(project.problem || 'The project needs a clearer research gap and motivation.')}

\section{Project Goal}
The objective of this work is to develop and evaluate ${latexEscape(project.topic || project.title)} with enough specificity for strict proposal review. The proposed work emphasizes concrete artifacts, measurable evaluation evidence, and source-grounded claims.

\section{Method and Agent Workflow}
${latexParagraph(project.method || 'The workflow extracts fields, asks for decisions, stores accepted project state, drafts artifacts, and supports review.')}

\section{Workflow Diagram}
\begin{figure}[!t]
\centering
\fbox{\begin{minipage}{0.92\linewidth}
\centering
Rough idea or PDF $\rightarrow$ accepted project state $\rightarrow$ student decisions $\rightarrow$ IEEE draft $\rightarrow$ strict review matrix $\rightarrow$ revised PDF
\end{minipage}}
\caption{Proposed proposal-agent workflow from input extraction to strict review and IEEE-formatted PDF generation.}
\label{fig:workflow}
\end{figure}

\section{Expected Results}
The expected result is a working prototype that produces an accepted project state, an IEEE-style proposal draft, a strict compliance matrix, and a previewable PDF artifact suitable for review and refinement.

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

\begin{thebibliography}{00}
${references}
\end{thebibliography}

\end{document}`;
}

function buildAbstract(project) {
  return `This proposal investigates ${project.topic || project.title}. It addresses the gap described in the project motivation, proposes a concrete workflow or method, and evaluates the resulting artifacts with strict requirements for completeness, source grounding, and measurable review evidence.`;
}

function buildIeeeReferences(references) {
  const items = clean(references)
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8);

  const safeItems = items.length ? items : ['Course proposal guidance and source notes, accessed during project development.'];

  return safeItems
    .slice(0, 12)
    .map((item, index) => `\\bibitem{ref${index + 1}} ${latexEscape(item)}.`)
    .join('\n');
}

function buildComplianceMatrix(project, requirements) {
  const requirementLines = clean(requirements)
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !/^proposal must include/i.test(line));

  return requirementLines.map((requirement) => {
    const review = strictReviewForRequirement(requirement, project);
    return {
      requirement,
      status: review.covered ? 'Covered' : 'Needs work',
      evidence: review.evidence,
      fix: review.fix
    };
  });
}

function strictReviewForRequirement(requirement, project) {
  const text = requirement.toLowerCase();
  if (/title/.test(text)) return reviewField(project.title, { label: 'title', minWords: 4 });
  if (/abstract/.test(text)) {
    return reviewCombined([project.topic, project.problem, project.method], {
      label: 'abstract basis',
      minWords: 70,
      markers: /problem|gap|method|workflow|evaluate|result|goal/i,
      fix: 'Add enough topic, problem, method, and evaluation detail for a meaningful abstract.'
    });
  }
  if (/motivation|gap|problem/.test(text)) {
    return reviewField(project.problem, {
      label: 'motivation/gap',
      minWords: 45,
      markers: /gap|problem|challenge|need|lack|insufficient|without|difficulty|miss/i
    });
  }
  if (/goal/.test(text)) {
    return reviewCombined([project.topic, project.problem, project.method], {
      label: 'project goal',
      minWords: 55,
      markers: /goal|create|build|develop|evaluate|improve|measure|prototype/i,
      fix: 'State a concrete project goal tied to the problem and method.'
    });
  }
  if (/method|workflow|agent/.test(text)) {
    return reviewField(project.method, {
      label: 'method/workflow',
      minWords: 55,
      markers: /workflow|step|input|output|agent|prototype|system|implement|generate|review|revise/i
    });
  }
  if (/figure|diagram/.test(text)) {
    return reviewCombined([project.method, project.resources], {
      label: 'figure/diagram plan',
      minWords: 45,
      markers: /figure|diagram|caption|workflow|architecture|pipeline/i,
      fix: 'Add a project-specific figure or diagram plan with a caption, not only the generated placeholder.'
    });
  }
  if (/expected|result/.test(text)) {
    return reviewCombined([project.method, project.evaluation], {
      label: 'expected results',
      minWords: 55,
      markers: /result|outcome|improve|measure|metric|evidence|compare|coverage/i,
      fix: 'Explain expected outcomes with measurable evidence, not only a general prototype statement.'
    });
  }
  if (/milestone|timeline/.test(text)) {
    return reviewField(project.timeline, {
      label: 'timeline/milestones',
      minWords: 25,
      markers: /phase|week|month|milestone|deliverable|deadline|stage|iteration/i
    });
  }
  if (/evaluation/.test(text)) {
    return reviewField(project.evaluation, {
      label: 'evaluation plan',
      minWords: 45,
      markers: /metric|baseline|compare|measure|rubric|success|failure|criteria|coverage|score/i
    });
  }
  if (/risk|mitigation/.test(text)) {
    return reviewCombined([project.problem, project.method, project.evaluation], {
      label: 'risk/mitigation',
      minWords: 80,
      markers: /risk|mitigation|failure|fallback|limitation|threat|bias|incomplete|validate/i,
      fix: 'Add project-specific risks and mitigations; generic generated risks are not enough for strict review.'
    });
  }
  if (/resource|budget/.test(text)) {
    return reviewField(project.resources, {
      label: 'resources/budget',
      minWords: 25,
      markers: /software|tool|data|compute|api|server|budget|time|review|resource|cost/i
    });
  }
  if (/reference|assumption|source/.test(text)) {
    return reviewField(project.references, {
      label: 'references/source notes',
      minWords: 35,
      markers: /20\d{2}|doi|https?:|paper|article|guide|source|author|et al|citation/i,
      fix: 'Add source notes with authors, years, URLs/DOIs, or specific papers tied to claims.'
    });
  }
  return {
    covered: false,
    evidence: 'No strict rubric rule matched this requirement.',
    fix: `Add details for: ${requirement}`
  };
}

function reviewCombined(values, options) {
  return reviewField(values.filter(Boolean).join(' '), options);
}

function reviewField(value, { label, minWords, markers, fix }) {
  const evidence = clean(value);
  const words = countWords(evidence);
  const hasEnoughWords = words >= minWords;
  const hasMarkers = markers ? markers.test(evidence) : true;
  const covered = hasEnoughWords && hasMarkers;

  return {
    covered,
    evidence: evidence
      ? `${label}: ${words} words${hasMarkers ? '' : '; missing required specificity markers'}. ${evidence.slice(0, 180)}${evidence.length > 180 ? '...' : ''}`
      : `No ${label} evidence was found.`,
    fix: covered
      ? 'Strict pass. Keep citations and specificity during final revision.'
      : fix || `Expand ${label} to at least ${minWords} words with concrete, requirement-specific evidence.`
  };
}

function buildEvaluationReport(project, matrix) {
  const covered = matrix.filter((row) => /^covered$/i.test(row.status)).length;
  const total = matrix.length || 1;
  const percent = Math.round((covered / total) * 100);
  const missing = matrix.filter((row) => !/^covered$/i.test(row.status));
  const strictLevel = percent >= 90 ? 'Strong' : percent >= 75 ? 'Developing' : percent >= 50 ? 'Weak' : 'High risk';

  return `Strict Proposal Review\n\nCoverage: ${covered}/${total} (${percent}%). Strict level: ${strictLevel}.\n\nStrict findings:\n${missing.length ? missing.map((row) => `- ${row.requirement}: ${row.fix}`).join('\n') : '- All listed requirements passed the strict evidence gates.'}\n\nNon-negotiable next steps:\n- Replace vague claims with measurable evidence, baselines, and success criteria.\n- Add project-specific risks, limitations, and mitigations.\n- Connect references/source notes to specific claims instead of listing generic guidance.\n- Review every Needs work row before treating the PDF as submission-ready.\n\nCurrent title: ${project.title}`;
}

function clean(value) {
  return String(value || '').trim();
}

function countWords(value) {
  return clean(value).split(/\s+/).filter(Boolean).length;
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

