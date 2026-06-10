import { PDFParse } from 'pdf-parse';

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

const SECTION_RULES = [
  { field: 'problem', pattern: /^(motivation|background|problem|gap|motivation and gap|research gap)$/i },
  { field: 'method', pattern: /^(method|methodology|approach|agent workflow|method and agent workflow|system design|proposed approach)$/i },
  { field: 'timeline', pattern: /^(timeline|milestones|timeline and milestones|research milestones|schedule|work plan)$/i },
  { field: 'evaluation', pattern: /^(evaluation|evaluation plan|assessment|validation|experiments|metrics)$/i },
  { field: 'resources', pattern: /^(resources|budget|resources and budget|materials|tools|implementation resources)$/i },
  { field: 'references', pattern: /^(references|source notes|references and source notes|bibliography|works cited|related work)$/i },
  { field: 'topic', pattern: /^(abstract|summary|project goal|goal|objective|expected results)$/i }
];

export async function extractProjectFromPdfBuffer(buffer, fileName = 'uploaded proposal.pdf') {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    throw new Error('Upload did not contain a readable PDF buffer.');
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const text = normalizeText(result.text);

    if (countWords(text) < 40) {
      throw new Error('The PDF did not contain enough extractable text. Try a text-based PDF instead of a scanned image.');
    }

    return buildProjectFromText(text, fileName);
  } finally {
    await parser.destroy();
  }
}

export function buildProjectFromText(text, fileName = 'uploaded proposal.pdf') {
  const cleanText = normalizeText(text);
  const sections = collectSections(cleanText);
  const title = cleanTitle(sections.title || firstMeaningfulLine(cleanText) || fileName.replace(/\.pdf$/i, ''));
  const project = {
    title,
    topic: compact(sections.topic || sections.abstract || title),
    problem: compact(sections.problem),
    method: compact(sections.method),
    evaluation: compact(sections.evaluation),
    timeline: compact(sections.timeline),
    resources: compact(sections.resources),
    references: compact(sections.references),
    requirements: DEFAULT_REQUIREMENTS
  };

  fillMissingFromKeywordWindows(project, cleanText);

  return {
    mode: 'pdf-import',
    provider: 'pdf-parse',
    project,
    extractedTextPreview: cleanText.slice(0, 900),
    fieldSuggestions: buildRepairSuggestions(project),
    decisions: buildImportDecisions(project),
    runMessage: `Extracted accepted project state from ${fileName}. Review the fields, then continue with decisions, drafting, and strict review.`
  };
}

function collectSections(text) {
  const sections = {};
  let currentField = '';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const heading = normalizeHeading(line);
    const rule = SECTION_RULES.find((item) => item.pattern.test(heading));

    if (index < 8 && /^title\s*:/i.test(line)) {
      sections.title = line.replace(/^title\s*:/i, '').trim();
      currentField = '';
      return;
    }

    if (rule) {
      currentField = rule.field;
      return;
    }

    if (!currentField && index === 0 && line.length < 140) {
      sections.title = line;
      return;
    }

    if (currentField) {
      sections[currentField] = [sections[currentField], line].filter(Boolean).join('\n');
    }
  });

  return sections;
}

function fillMissingFromKeywordWindows(project, text) {
  const windows = [
    ['problem', /(?:problem|gap|motivation|challenge|need)[\s:.-]+(.{120,700}?)(?=\n[A-Z][A-Za-z ]{2,45}\n|$)/is],
    ['method', /(?:method|workflow|approach|system|prototype)[\s:.-]+(.{120,800}?)(?=\n[A-Z][A-Za-z ]{2,45}\n|$)/is],
    ['evaluation', /(?:evaluation|metric|measure|experiment|validate)[\s:.-]+(.{100,700}?)(?=\n[A-Z][A-Za-z ]{2,45}\n|$)/is],
    ['timeline', /(?:timeline|milestone|phase|week|month)[\s:.-]+(.{80,600}?)(?=\n[A-Z][A-Za-z ]{2,45}\n|$)/is],
    ['resources', /(?:resources|budget|tools|software|hardware)[\s:.-]+(.{80,600}?)(?=\n[A-Z][A-Za-z ]{2,45}\n|$)/is],
    ['references', /(?:references|bibliography|works cited|source notes)[\s:.-]+(.{80,900}?)(?=$)/is]
  ];

  windows.forEach(([field, pattern]) => {
    if (project[field]) return;
    const match = text.match(pattern);
    if (match?.[1]) project[field] = compact(match[1]);
  });
}

function buildRepairSuggestions(project) {
  return [
    ['problem', 'Problem', 'Add a precise research gap, affected users, and why current approaches are insufficient.'],
    ['method', 'Method', 'Add concrete workflow steps, inputs/outputs, implementation choices, and what the agent actually does.'],
    ['evaluation', 'Evaluation', 'Add metrics, baselines, datasets or test cases, and pass/fail criteria.'],
    ['timeline', 'Timeline', 'Add dated phases or week/month milestones with deliverables.'],
    ['resources', 'Resources', 'Add software, data, compute, budget, and human review needs.'],
    ['references', 'Sources', 'Add at least five source notes with authors/years/URLs or DOIs.']
  ]
    .filter(([field]) => countWords(project[field]) < minimumWordsForField(field))
    .map(([field, label, value]) => ({
      field,
      label,
      value,
      reason: 'The PDF import found this field missing or too thin for strict review.',
      confidence: 'High'
    }));
}

function buildImportDecisions(project) {
  const decisions = [];

  if (countWords(project.method) < minimumWordsForField('method')) {
    decisions.push({
      id: 'import-method-depth',
      field: 'method',
      title: 'Tighten imported method',
      question: 'What should the next draft emphasize to make the method pass strict review?',
      options: [
        {
          label: 'Workflow details',
          value: 'The method should specify each agent step, input and output artifacts, human checkpoints, and failure handling.',
          rationale: 'Strict review expects operational detail, not a general description.'
        },
        {
          label: 'Evaluation hooks',
          value: 'The method should connect each workflow step to measurable evaluation evidence and revision criteria.',
          rationale: 'This makes the method easier to validate later.'
        }
      ]
    });
  }

  if (countWords(project.evaluation) < minimumWordsForField('evaluation')) {
    decisions.push({
      id: 'import-evaluation-depth',
      field: 'evaluation',
      title: 'Tighten imported evaluation',
      question: 'Which strict evaluation evidence should be added first?',
      options: [
        {
          label: 'Metrics and baselines',
          value: 'Evaluate with requirement coverage, unsupported-claim counts, source quality, revision improvement, and comparison to a manually written baseline.',
          rationale: 'Strict review needs measurable criteria.'
        },
        {
          label: 'Reviewer rubric',
          value: 'Evaluate with a rubric for clarity, feasibility, novelty, source grounding, and method specificity, scored before and after revision.',
          rationale: 'This matches proposal-review expectations.'
        }
      ]
    });
  }

  return decisions;
}

function minimumWordsForField(field) {
  return {
    problem: 45,
    method: 55,
    evaluation: 45,
    timeline: 25,
    resources: 25,
    references: 20
  }[field] || 15;
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\u2018|\u2019|\u201A|\u201B/g, "'")
    .replace(/\u201C|\u201D|\u201E|\u201F/g, '"')
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\uFFFD/g, '')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/â€“|â€”/g, '-')
    .replace(/â€¢/g, '-')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/\r/g, '')
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeading(value) {
  return String(value || '')
    .replace(/^\d+(?:\.\d+)*\s*/, '')
    .replace(/[:.-]\s*$/, '')
    .trim();
}

function cleanTitle(value) {
  return compact(value)
    .replace(/^title\s*:/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 140)
    .trim() || 'Imported Proposal';
}

function firstMeaningfulLine(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length >= 8 && line.length <= 140 && !/^pdf preview|latex compiler|proposal review/i.test(line));
}

function compact(value) {
  return String(value || '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}
