import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Download, FileText, Loader2, Play, RefreshCw, Sparkles } from 'lucide-react';

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

const EMPTY_PROJECT = {
  title: '',
  topic: '',
  problem: '',
  method: '',
  timeline: '',
  evaluation: '',
  resources: '',
  references: '',
  requirements: DEFAULT_REQUIREMENTS
};

const PROJECT_FIELDS = [
  ['problem', 'Problem'],
  ['method', 'Method'],
  ['evaluation', 'Evaluation'],
  ['timeline', 'Timeline'],
  ['resources', 'Resources'],
  ['references', 'Sources']
];

const TABS = [
  ['pdf', 'PDF'],
  ['latex', 'LaTeX'],
  ['matrix', 'Matrix'],
  ['evaluation', 'Review'],
  ['analysis', 'Analysis']
];

const PROJECT_FIELD_PAIRS = safePairs(PROJECT_FIELDS);
const TAB_PAIRS = safePairs(TABS);

function safePairs(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => Array.isArray(item) && item.length >= 2 && item[0])
    .map((item) => [String(item[0]), String(item[1] || item[0])]);
}

function App() {
  const [topicInput, setTopicInput] = useState('');
  const [project, setProject] = useState(EMPTY_PROJECT);
  const [suggestions, setSuggestions] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [result, setResult] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [runLog, setRunLog] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pdf');

  const busy = status !== 'idle';
  const coveredRows = result?.complianceMatrix?.filter((row) => /^covered$/i.test(row.status)).length || 0;
  const totalRows = result?.complianceMatrix?.length || 0;
  const acceptedCount = PROJECT_FIELD_PAIRS.filter((pair) => project[pair[0]]).length;
  const analysis = result ? analyzeProposal(project, result, coveredRows, totalRows) : null;

  async function structureIdea(topic = topicInput) {
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    setStatus('starting');
    setError('');
    clearArtifacts();

    try {
      const data = await postJson('/api/agent/start', {
        topic: cleanTopic,
        requirements: DEFAULT_REQUIREMENTS
      });

      setTopicInput(cleanTopic);
      setProject({ ...EMPTY_PROJECT, ...data.project });
      setSuggestions(data.fieldSuggestions || []);
      setDecisions(data.decisions || []);
      setRunLog([
        createLog('Extract', data.runMessage || 'Structured the rough idea.'),
        createLog('Decide', `Loaded ${(data.fieldSuggestions || []).length} suggestion(s).`)
      ]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  function runSample() {
    structureIdea('Citation-grounded agent for literature review workflows');
  }

  function updateProjectField(field, value) {
    setProject((current) => ({
      ...current,
      [field]: value,
      topic: current.topic || current.title || topicInput
    }));
    clearArtifacts();
  }

  function acceptSuggestion(suggestion) {
    updateProjectField(suggestion.field, suggestion.value);
    setSuggestions((current) => current.filter((item) => item !== suggestion));
    setRunLog((current) => [...current, createLog('Accept', `Accepted ${suggestion.label || suggestion.field}.`)]);
  }

  function skipSuggestion(suggestion) {
    setSuggestions((current) => current.filter((item) => item !== suggestion));
    setRunLog((current) => [...current, createLog('Skip', `Skipped ${suggestion.label || suggestion.field}.`)]);
  }

  function chooseDecision(decision, option) {
    updateProjectField(decision.field, option.value);
    setDecisions((current) => current.filter((item) => item.id !== decision.id));
    setRunLog((current) => [...current, createLog('Decision', `Selected ${option.label} for ${decision.title}.`)]);
  }

  async function generateProposal() {
    setStatus('drafting');
    setError('');

    try {
      const data = await postJson('/api/proposal', {
        ...project,
        topic: project.topic || project.title || topicInput,
        requirements: DEFAULT_REQUIREMENTS
      });
      const nextPdfUrl = await exportPdfUrl(data.proposalLatex, project.title || 'proposal');

      setResult(data);
      updatePdfUrl(nextPdfUrl);
      setActiveTab('pdf');
      setRunLog((current) => [
        ...current,
        createLog('Draft', `Generated proposal using ${data.mode}.`),
        createLog('Review', `Coverage ${countCovered(data.complianceMatrix)}/${data.complianceMatrix?.length || 0}.`),
        createLog('Score', `Analysis score ${analyzeProposal(project, data).scores.overall}/100.`)
      ]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  function downloadLatex() {
    if (!result?.proposalLatex) return;

    const href = URL.createObjectURL(new Blob([result.proposalLatex], { type: 'text/x-tex;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'proposal.tex';
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function downloadPdf() {
    if (!result?.proposalLatex) return;

    setStatus('exporting');
    setError('');

    try {
      const href = pdfUrl || (await exportPdfUrl(result.proposalLatex, project.title || 'proposal'));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'proposal.pdf';
      anchor.click();
      if (!pdfUrl) URL.revokeObjectURL(href);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  async function openPdfPreview() {
    if (!result?.proposalLatex) return;

    setStatus('exporting');
    setError('');

    try {
      const href = pdfUrl || (await exportPdfUrl(result.proposalLatex, project.title || 'proposal'));
      window.open(href, '_blank', 'noopener,noreferrer');
      if (!pdfUrl) updatePdfUrl(href);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
  }

  function updatePdfUrl(nextUrl) {
    setPdfUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextUrl;
    });
  }

  function clearArtifacts() {
    setResult(null);
    updatePdfUrl('');
  }

  function reset() {
    setTopicInput('');
    setProject(EMPTY_PROJECT);
    setSuggestions([]);
    setDecisions([]);
    setResult(null);
    updatePdfUrl('');
    setRunLog([]);
    setError('');
    setStatus('idle');
    setActiveTab('pdf');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Research Proposal Agent</h1>
        <span className="status-pill">
          <Sparkles size={16} aria-hidden="true" />
          {result?.mode || (suggestions.length ? 'structuring' : 'ready')}
        </span>
      </header>

      <section className="workspace single-pane">
        <section className="workflow-artifact">
          <div className="topic-launch">
            <label htmlFor="project-topic">
              Rough Idea
              <input
                id="project-topic"
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') structureIdea();
                }}
                placeholder="Example: Agent for citation-grounded literature review"
              />
            </label>
            <div className="actions framework-actions">
              <button className="primary" type="button" disabled={!topicInput.trim() || busy} onClick={() => structureIdea()}>
                {status === 'starting' ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                Structure Idea
              </button>
              <button className="secondary" type="button" disabled={busy} onClick={runSample}>
                <Sparkles size={18} />
                Sample
              </button>
              <button className="secondary icon-button" type="button" onClick={reset} aria-label="Reset">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <div className="workflow-grid" aria-label="Workflow stages">
            {['Extract', 'Decide', 'Assemble', 'Draft', 'Review'].map((stage, index) => (
              <article className="stage-card" key={stage}>
                <div className="stage-topline">
                  <span className="stage-number">{index + 1}</span>
                  <span className={`stage-status ${stageStatus(index, suggestions, decisions, project, result)}`}>
                    {stageLabel(index, suggestions, decisions, project, result)}
                  </span>
                </div>
                <h3>{stage}</h3>
                <p>{stageDescriptions[index]}</p>
              </article>
            ))}
          </div>

          <div className="workspace-grid">
            <section className="workspace-panel suggestions-panel">
              <PanelHeader title="LLM Suggested Structure" meta={`${suggestions.length} fields`} />
              {suggestions.length ? (
                <div className="suggestion-deck">
                  {suggestions.map((suggestion) => (
                    <article className="suggestion-card active-card" key={`${suggestion.field}-${suggestion.value}`}>
                      <div className="card-line">
                        <h3>{suggestion.label || labelForField(suggestion.field)}</h3>
                        <span className={`priority ${String(suggestion.confidence || 'medium').toLowerCase()}`}>
                          {suggestion.confidence || 'Medium'}
                        </span>
                      </div>
                      <p>{suggestion.value}</p>
                      <small>{suggestion.reason}</small>
                      <div className="deck-actions">
                        <button className="primary" type="button" onClick={() => acceptSuggestion(suggestion)}>
                          <CheckCircle2 size={16} />
                          Accept
                        </button>
                        <button className="secondary" type="button" onClick={() => skipSuggestion(suggestion)}>
                          Skip
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState text="Enter a rough idea, then let the model structure it." compact />
              )}
            </section>

            <section className="workspace-panel decisions-panel">
              <PanelHeader title="Decision Needed" meta={`${decisions.length} open`} />
              {decisions.length ? (
                <div className="decision-deck">
                  {decisions.map((decision) => (
                    <article className="decision-card active-card" key={decision.id}>
                      <h3>{decision.title}</h3>
                      <p>{decision.question}</p>
                      <div className="option-stack">
                        {decision.options.map((option) => (
                          <button
                            className="option-button"
                            key={`${decision.id}-${option.label}`}
                            type="button"
                            onClick={() => chooseDecision(decision, option)}
                          >
                            <strong>{option.label}</strong>
                            <span>{option.value}</span>
                            <small>{option.rationale}</small>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState text="No major decision is open. Review the accepted state or draft the proposal." compact />
              )}
            </section>

            <section className="workspace-panel state-panel">
              <PanelHeader title="Accepted Project State" meta={`${acceptedCount}/${PROJECT_FIELD_PAIRS.length} ready`} />
              <label>
                Project Title
                <input value={project.title} onChange={(event) => updateProjectField('title', event.target.value)} />
              </label>
              {PROJECT_FIELD_PAIRS.map((pair) => {
                const [field, label] = pair;
                return (
                <label key={field}>
                  {label}
                  <textarea value={project[field] || ''} onChange={(event) => updateProjectField(field, event.target.value)} />
                </label>
                );
              })}
              <button className="primary" type="button" disabled={!project.title || busy} onClick={generateProposal}>
                {status === 'drafting' ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
                Generate Proposal
              </button>
            </section>
          </div>

          <div className="workflow-columns">
            <section className="workflow-panel">
              <h2>Run Log</h2>
              {runLog.length ? (
                <ol className="run-log">
                  {runLog.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.stage}</span>
                      <p>{entry.message}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState text="Run log appears after the idea is structured." compact />
              )}
            </section>

            <section className="workflow-panel artifacts-panel">
              <div className="artifact-toolbar">
                <nav className="tabs" aria-label="Generated artifacts">
                  {TAB_PAIRS.map((pair) => {
                    const [id, label] = pair;
                    return (
                    <button key={id} className={activeTab === id ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab(id)}>
                      {id === 'matrix' ? <ClipboardCheck size={17} /> : id === 'analysis' ? <Sparkles size={17} /> : <FileText size={17} />}
                      {label}
                    </button>
                    );
                  })}
                </nav>
                <button className="secondary" type="button" disabled={!result?.proposalLatex} onClick={downloadLatex}>
                  <Download size={17} />
                  LaTeX
                </button>
                <button className="secondary" type="button" disabled={!result?.proposalLatex || busy} onClick={openPdfPreview}>
                  <FileText size={17} />
                  Open Preview
                </button>
                <button className="primary" type="button" disabled={!result?.proposalLatex || busy} onClick={downloadPdf}>
                  <Download size={17} />
                  PDF
                </button>
              </div>

              <div className="artifact-summary">
                <div>
                  <span>Coverage</span>
                  <strong>{totalRows ? `${coveredRows}/${totalRows}` : '0/0'}</strong>
                </div>
                <div>
                  <span>Accepted</span>
                  <strong>{acceptedCount}/{PROJECT_FIELD_PAIRS.length}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{result?.provider || 'waiting'}</strong>
                </div>
              </div>

              {renderArtifact(activeTab, result, pdfUrl, analysis)}
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

const stageDescriptions = [
  'Model turns your rough idea into proposal fields.',
  'You accept, skip, or edit suggestions.',
  'Accepted fields become project state.',
  'The app generates LaTeX and PDF artifacts.',
  'The matrix and review report show weak spots.'
];

async function postJson(url, body) {
  const requestBody = JSON.stringify(body);
  let lastError = null;

  for (const apiUrl of candidateApiUrls(url)) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
      const text = await response.text();

      if (!text.trim()) {
        lastError = new Error(`Empty response from ${apiUrl} (status ${response.status}).`);
        continue;
      }

      const data = parseJsonResponse(text, apiUrl);

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || `Request failed with status ${response.status}.`);
      }

      return data;
    } catch (requestError) {
      lastError = requestError;
    }
  }

  throw new Error(
    `${readError(lastError)} Make sure the API terminal says "Proposal API listening on http://127.0.0.1:8787", then refresh the browser.`
  );
}

function candidateApiUrls(url) {
  if (!url.startsWith('/api')) return [url];
  return [url, `http://127.0.0.1:8787${url}`];
}

function parseJsonResponse(text, url) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The proposal API returned non-JSON for ${url}: ${text.slice(0, 180)}`);
  }
}

async function exportPdfUrl(proposalLatex, title) {
  const requestBody = JSON.stringify({ title, proposalLatex });
  let lastError = null;

  for (const apiUrl of candidateApiUrls('/api/export/pdf')) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, apiUrl));
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (requestError) {
      lastError = requestError;
    }
  }

  throw new Error(`${readError(lastError)} Make sure npm.cmd run dev is still running.`);
}

async function readResponseError(response, url) {
  const text = await response.text();

  if (!text.trim()) {
    return `The proposal API returned an empty error response for ${url} with status ${response.status}.`;
  }

  try {
    const data = JSON.parse(text);
    return data.detail || data.error || `Request failed with status ${response.status}.`;
  } catch {
    return `The proposal API returned non-JSON for ${url}: ${text.slice(0, 180)}`;
  }
}

function renderArtifact(activeTab, result, pdfUrl, analysis) {
  if (!result) {
    return <EmptyState text="Proposal artifacts appear after Generate Proposal." />;
  }

  if (activeTab === 'pdf') {
    if (!pdfUrl) {
      return <EmptyState text="PDF preview is rendering. If it stays blank in VS Code, use Open Preview." />;
    }

    return (
      <div className="pdf-preview-frame">
        <object className="pdf-preview" data={pdfUrl} type="application/pdf" aria-label="Compiled proposal PDF preview">
          <iframe className="pdf-preview" src={pdfUrl} title="Compiled proposal PDF" />
          <p className="pdf-preview-help">Your browser did not render the PDF inline. Use Open Preview or download the PDF.</p>
        </object>
      </div>
    );
  }

  if (activeTab === 'matrix') {
    return (
      <div className="matrix-wrap">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            {(result.complianceMatrix || []).map((row, index) => (
              <tr key={`${row.requirement}-${index}`}>
                <td>{row.requirement}</td>
                <td>
                  <span className={/^covered$/i.test(row.status) ? 'badge covered' : 'badge needs-work'}>{row.status}</span>
                </td>
                <td>{row.evidence}</td>
                <td>{row.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeTab === 'evaluation') {
    return <pre>{result.evaluationReport}</pre>;
  }

  if (activeTab === 'analysis') {
    return analysis ? <AnalysisPanel analysis={analysis} /> : <EmptyState text="Analysis appears after Generate Proposal." />;
  }

  return <pre className="proposal-output">{result.proposalLatex}</pre>;
}

function AnalysisPanel({ analysis }) {
  return (
    <div className="analysis-wrap">
      <section className="score-card">
        <div className={`score-circle ${analysis.scores.gradeColor}`}>
          <strong>{analysis.scores.overall}</strong>
          <span>{analysis.scores.grade}</span>
        </div>
        <div>
          <h3>Proposal Score</h3>
          <p>{analysis.summary}</p>
        </div>
      </section>

      <section className="analysis-section">
        <h3>5-Dimension Scoring Breakdown</h3>
        <div className="score-grid">
          {analysis.dimensionScores.map((item) => (
            <div className="score-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.score}/100</strong>
              <div className="score-meter"><span style={{ width: `${item.score}%` }} /></div>
              <small>{item.note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="analysis-section">
        <h3>Graduate Readiness</h3>
        <div className="readiness-bar"><span style={{ width: `${analysis.graduateReadiness.readinessPercent}%` }} /></div>
        <p><strong>{analysis.graduateReadiness.readinessPercent}% readiness</strong> — {analysis.graduateReadiness.readinessLevel}</p>
        <ul className="analysis-checklist">
          {analysis.graduateReadiness.checklist.map((item) => (
            <li className={item.met ? 'met' : 'unmet'} key={item.name}>{item.met ? '✓' : '○'} {item.name}</li>
          ))}
        </ul>
      </section>

      <section className="analysis-section">
        <h3>Language Analysis</h3>
        <div className="metric-row"><span>Academic tone</span><strong>{analysis.languageAnalysis.academicTone}/100</strong></div>
        <div className="metric-row"><span>Technical terminology</span><strong>{analysis.languageAnalysis.technicalTermCount} terms</strong></div>
        <div className="metric-row"><span>Readability</span><strong>{analysis.languageAnalysis.readability}/100</strong></div>
        <div className="metric-row"><span>Average sentence length</span><strong>{analysis.languageAnalysis.averageSentenceLength} words</strong></div>
        <p>{analysis.languageAnalysis.note}</p>
      </section>

      <section className="analysis-section">
        <h3>Reference Validation</h3>
        <div className="metric-row"><span>Reference count</span><strong>{analysis.referenceAnalysis.count}</strong></div>
        <div className="metric-row"><span>Quality</span><strong>{analysis.referenceAnalysis.quality}</strong></div>
        <ul>
          {analysis.referenceAnalysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      </section>

      <section className="analysis-section">
        <h3>Smart Recommendations</h3>
        {analysis.recommendations.map((recommendation) => (
          <article className={`recommendation ${recommendation.priority.toLowerCase()}`} key={recommendation.area}>
            <strong>{recommendation.priority}: {recommendation.area}</strong>
            <p>{recommendation.message}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function analyzeProposal(project, result, coveredRows = countCovered(result?.complianceMatrix || []), totalRows = result?.complianceMatrix?.length || 0) {
  const text = [project.title, project.problem, project.method, project.timeline, project.evaluation, project.resources, project.references, result?.proposalLatex].join(' ');
  const wordCount = countWords(text);
  const references = extractReferences(project.references);
  const technicalTerms = countTechnicalTerms(text);
  const sentenceStats = sentenceComplexity(text);
  const completion = totalRows ? Math.round((coveredRows / totalRows) * 100) : 0;
  const researchQuality = clamp(Math.round((project.problem ? 20 : 0) + (project.method ? 20 : 0) + (project.evaluation ? 20 : 0) + Math.min(references.length * 12, 40)));
  const clarity = clamp(Math.round(72 + (project.problem ? 8 : 0) + (sentenceStats.averageLength > 28 ? -8 : 8)));
  const technical = clamp(Math.round(Math.min(technicalTerms * 7, 55) + (project.method ? 25 : 0) + (project.evaluation ? 15 : 0)));
  const referenceScore = clamp(Math.round(Math.min(references.length * 22, 80) + (/paper|citation|source|guide|feedback/i.test(project.references || '') ? 20 : 0)));
  const completionScore = clamp(completion);
  const overall = clamp(Math.round((researchQuality * 0.26) + (clarity * 0.18) + (technical * 0.2) + (referenceScore * 0.16) + (completionScore * 0.2)));
  const grade = gradeForScore(overall);
  const readinessChecklist = [
    ['Clear research gap', Boolean(project.problem)],
    ['Concrete method/workflow', Boolean(project.method)],
    ['Evaluation plan', Boolean(project.evaluation)],
    ['Timeline and milestones', Boolean(project.timeline)],
    ['Resources/budget', Boolean(project.resources)],
    ['Source notes/references', Boolean(project.references)],
    ['Generated artifact review', Boolean(result?.complianceMatrix?.length)]
  ];
  const readinessMet = readinessChecklist.filter(([, met]) => met).length;

  return {
    summary: `Overall score ${overall}/100 based on proposal completeness, source grounding, technical detail, and language quality.`,
    scores: { overall, grade, gradeColor: gradeColor(grade) },
    dimensionScores: [
      { label: 'Research Quality', score: researchQuality, note: 'Gap, method, evaluation, and source grounding.' },
      { label: 'Clarity', score: clarity, note: 'Readable structure and sentence complexity.' },
      { label: 'Technical Depth', score: technical, note: 'Workflow, evaluation, and technical terminology.' },
      { label: 'References', score: referenceScore, note: 'Reference count and source-note quality.' },
      { label: 'Completion', score: completionScore, note: `${coveredRows}/${totalRows || 0} checklist items covered.` }
    ],
    graduateReadiness: {
      readinessPercent: Math.round((readinessMet / readinessChecklist.length) * 100),
      readinessLevel: readinessMet >= 6 ? 'Ready for graduate-level revision' : readinessMet >= 4 ? 'Promising but needs refinement' : 'Needs major development',
      checklist: readinessChecklist
        .filter((item) => Array.isArray(item) && item.length >= 2)
        .map((item) => ({ name: item[0], met: Boolean(item[1]) }))
    },
    languageAnalysis: {
      academicTone: clamp(Math.round(65 + countMatches(text, /evaluate|proposal|method|evidence|research|workflow|criteria/gi) * 2)),
      technicalTermCount: technicalTerms,
      readability: clamp(Math.round(90 - Math.max(sentenceStats.averageLength - 18, 0) * 2)),
      averageSentenceLength: sentenceStats.averageLength,
      note: wordCount > 250 ? 'The draft has enough substance for review; revise long sentences for readability.' : 'Add more detail to improve academic depth and readability confidence.'
    },
    referenceAnalysis: {
      count: references.length,
      quality: references.length >= 4 ? 'Strong' : references.length >= 2 ? 'Developing' : 'Needs more sources',
      suggestions: references.length >= 3
        ? ['Connect each source to a specific claim.', 'Add citation details before final submission.']
        : ['Add at least three relevant papers or proposal-writing sources.', 'Include source notes from seed papers or citation-graph exploration.']
    },
    recommendations: buildRecommendations({ project, references, overall, completionScore, technical, clarity })
  };
}

function buildRecommendations({ project, references, overall, completionScore, technical, clarity }) {
  const recommendations = [];
  if (!project.evaluation) recommendations.push({ priority: 'High', area: 'Evaluation', message: 'Add concrete metrics, comparison baselines, and success criteria.' });
  if (references.length < 3) recommendations.push({ priority: 'High', area: 'References', message: 'Add more source notes, seed papers, or Connected Papers-style evidence.' });
  if (technical < 70) recommendations.push({ priority: 'Medium', area: 'Technical Depth', message: 'Describe the agent workflow, data flow, and review loop in more detail.' });
  if (clarity < 75) recommendations.push({ priority: 'Medium', area: 'Clarity', message: 'Shorten long sentences and make each section start with a clear claim.' });
  if (completionScore < 80) recommendations.push({ priority: 'High', area: 'Completion', message: 'Fill missing proposal requirements before recording or submitting.' });
  if (overall >= 85) recommendations.push({ priority: 'Low', area: 'Polish', message: 'The draft is strong; focus on citations, examples, and final proofreading.' });
  return recommendations.slice(0, 5);
}

function extractReferences(value) {
  return String(value || '').split(/\n|;|\.|,/).map((item) => item.trim()).filter((item) => item.length > 8);
}

function countTechnicalTerms(text) {
  return countMatches(text, /agent|workflow|evaluation|citation|retrieval|proposal|matrix|latex|pdf|model|source|rubric|prototype|revision|grounding/gi);
}

function sentenceComplexity(text) {
  const sentences = String(text || '').split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const words = countWords(text);
  return { averageLength: sentences.length ? Math.round(words / sentences.length) : 0 };
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function gradeForScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'Needs Work';
}

function gradeColor(grade) {
  if (grade === 'A') return 'grade-a';
  if (grade === 'B') return 'grade-b';
  if (grade === 'C') return 'grade-c';
  return 'grade-needs-work';
}

function PanelHeader({ title, meta }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

function EmptyState({ text, compact = false }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <FileText size={compact ? 24 : 32} aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function stageStatus(index, suggestions, decisions, project, result) {
  if (index === 0 && suggestions.length) return 'status-complete';
  if (index === 1 && decisions.length) return 'status-complete';
  if (index === 2 && PROJECT_FIELD_PAIRS.some((pair) => project[pair[0]])) return 'status-complete';
  if (index >= 3 && result) return 'status-complete';
  return 'status-waiting';
}

function stageLabel(index, suggestions, decisions, project, result) {
  if (index === 0 && suggestions.length) return 'Shown';
  if (index === 1 && decisions.length) return 'Shown';
  if (index === 2 && PROJECT_FIELD_PAIRS.some((pair) => project[pair[0]])) return 'Shown';
  if (index >= 3 && result) return 'Shown';
  return 'Ready';
}

function countCovered(rows = []) {
  return rows.filter((row) => /^covered$/i.test(row.status)).length;
}

function labelForField(field) {
  const found = PROJECT_FIELD_PAIRS.find((pair) => pair[0] === field);
  return found?.[1] || 'Field';
}

function createLog(stage, message) {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    stage,
    message
  };
}

function readError(error) {
  return error instanceof Error ? error.message : String(error);
}

export default App;
