import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Download, FileText, Loader2, Play, RefreshCw, Sparkles, Upload } from 'lucide-react';

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
const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787');

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

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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

  async function importPdfProject(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (file.type && file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Please upload a PDF smaller than 10 MB.');
      return;
    }

    setStatus('importing');
    setError('');
    clearArtifacts();

    try {
      const pdfBase64 = await fileToBase64(file);
      const data = await postJson('/api/project/from-pdf', {
        fileName: file.name,
        pdfBase64
      });

      setTopicInput(data.project?.topic || data.project?.title || '');
      setProject({ ...EMPTY_PROJECT, ...data.project });
      setSuggestions(data.fieldSuggestions || []);
      setDecisions(data.decisions || []);
      setActiveTab('pdf');
      setRunLog([
        createLog('Import', data.runMessage || 'Imported accepted project state from PDF.'),
        createLog('Skip', 'Skipped rough-idea structuring and loaded the extracted state for editing.'),
        createLog('Review', `Strict repair suggestions loaded: ${(data.fieldSuggestions || []).length}.`)
      ]);
    } catch (requestError) {
      setError(readError(requestError));
    } finally {
      setStatus('idle');
    }
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
              <PanelHeader title="Suggested Structure / Repairs" meta={`${suggestions.length} fields`} />
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
              <div className="reference-upload-card">
                <div>
                  <h3><Upload size={16} aria-hidden="true" /> Import Accepted State From PDF</h3>
                  <p>Upload a text-based proposal PDF to skip rough-idea extraction and continue with decisions, drafting, strict review, and analysis.</p>
                </div>
                <label htmlFor="project-pdf-upload">
                  PDF Proposal
                  <input id="project-pdf-upload" type="file" accept="application/pdf" disabled={busy} onChange={importPdfProject} />
                </label>
                {status === 'importing' ? (
                  <p className="override-help">
                    <Loader2 className="spin inline-spinner" size={16} />
                    Extracting project state from PDF...
                  </p>
                ) : null}
              </div>
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
                  {TAB_PAIRS.map(([id, label]) => (
                    <button key={id} className={activeTab === id ? 'tab active' : 'tab'} type="button" onClick={() => setActiveTab(id)}>
                      {id === 'matrix' ? <ClipboardCheck size={17} /> : id === 'analysis' ? <Sparkles size={17} /> : <FileText size={17} />}
                      {label}
                    </button>
                  ))}
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

              {renderArtifact(activeTab, result, pdfUrl, analysis, project)}
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
  return uniqueItems([url, `${API_BASE_URL}${url}`]);
}

function normalizeApiBase(value) {
  return String(value || '').replace(/\/+$/, '') || 'http://127.0.0.1:8787';
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the PDF file.'));
    reader.readAsDataURL(file);
  });
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

      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: 'application/pdf' });
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

function renderArtifact(activeTab, result, pdfUrl, analysis, project) {
  if (!result) {
    return <EmptyState text="Proposal artifacts appear after Generate Proposal." />;
  }

  if (activeTab === 'pdf') {
    return <IeeePaperPreview project={project} pdfUrl={pdfUrl} />;
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
        <p><strong>{analysis.graduateReadiness.readinessPercent}% readiness</strong> - {analysis.graduateReadiness.readinessLevel}</p>
        <ul className="analysis-checklist">
          {analysis.graduateReadiness.checklist.map((item) => (
            <li className={item.met ? 'met' : 'unmet'} key={item.name}>{item.met ? 'Yes' : 'No'}: {item.name}</li>
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

function IeeePaperPreview({ project, pdfUrl }) {
  const references = extractReferences(project.references);
  const bibliography = references.length ? references : ['Add IEEE-style references or source notes before final submission.'];

  return (
    <div className="ieee-preview-shell">
      <article className="ieee-page" aria-label="IEEE paper preview">
        <header className="ieee-header">
          <h2>{project.title || 'Untitled Research Proposal'}</h2>
          <p>Proposal Draft</p>
          <p>Generated Research Proposal, Local Proposal Agent Workflow</p>
        </header>

        <section className="ieee-abstract">
          <h3>Abstract</h3>
          <p>{buildPreviewAbstract(project)}</p>
          <h3>Keywords</h3>
          <p>research proposal, agent workflow, source grounding, evaluation, PDF generation</p>
        </section>

        <div className="ieee-columns">
          <IeeeSection title="I. Introduction and Motivation" text={project.problem || 'The project needs a clearer research gap and motivation.'} />
          <IeeeSection title="II. Project Goal" text={`The objective of this work is to develop and evaluate ${project.topic || project.title || 'the proposed project'} with enough specificity for strict proposal review. The proposed work emphasizes concrete artifacts, measurable evaluation evidence, and source-grounded claims.`} />
          <IeeeSection title="III. Method and Agent Workflow" text={project.method || 'The workflow extracts fields, asks for decisions, stores accepted project state, drafts artifacts, and supports review.'} />

          <figure className="ieee-figure">
            <div>{'Rough idea or PDF -> accepted state -> decisions -> IEEE draft -> strict review -> revised PDF'}</div>
            <figcaption>Fig. 1. Proposed proposal-agent workflow.</figcaption>
          </figure>

          <IeeeSection title="IV. Expected Results" text="The expected result is a working prototype that produces an accepted project state, an IEEE-style proposal draft, a strict compliance matrix, and a previewable PDF artifact suitable for review and refinement." />
          <IeeeSection title="V. Timeline and Milestones" text={project.timeline || 'The work proceeds through prototype, refinement, evaluation, and final proposal preparation milestones.'} />
          <IeeeSection title="VI. Evaluation Plan" text={project.evaluation || 'The proposal will be evaluated with a checklist matrix, reviewer feedback, and revision evidence.'} />
          <IeeeSection title="VII. Risks and Mitigation" text="Generated text may be incomplete, related work may be weak, and PDF compilation may fail locally. Mitigations include editable fields, explicit source notes, strict requirement review, and the built-in fallback renderer." />
          <IeeeSection title="VIII. Resources and Budget" text={project.resources || 'The project uses a local web app, API server, source notes, and human review time.'} />

          <section className="ieee-section">
            <h3>References</h3>
            <ol className="ieee-references">
              {bibliography.slice(0, 12).map((reference, index) => (
                <li key={`${reference}-${index}`}>{reference}</li>
              ))}
            </ol>
          </section>
        </div>
      </article>

      {pdfUrl ? (
        <details className="native-pdf-details">
          <summary>Browser PDF embed</summary>
          <iframe className="pdf-preview" src={pdfUrl} title="Compiled proposal PDF preview" />
        </details>
      ) : null}
    </div>
  );
}

function IeeeSection({ title, text }) {
  return (
    <section className="ieee-section">
      <h3>{title}</h3>
      {paragraphs(text).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

function buildPreviewAbstract(project) {
  return `This proposal investigates ${project.topic || project.title || 'the proposed project'}. It addresses the gap described in the project motivation, proposes a concrete workflow or method, and evaluates the resulting artifacts with strict requirements for completeness, source grounding, and measurable review evidence.`;
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function analyzeProposal(project, result, coveredRows = countCovered(result?.complianceMatrix || []), totalRows = result?.complianceMatrix?.length || 0) {
  const text = [project.title, project.problem, project.method, project.timeline, project.evaluation, project.resources, project.references, result?.proposalLatex].join(' ');
  const wordCount = countWords(text);
  const references = extractReferences(project.references);
  const technicalTerms = countTechnicalTerms(text);
  const sentenceStats = sentenceComplexity(text);
  const completion = totalRows ? Math.round((coveredRows / totalRows) * 100) : 0;
  const problemScore = strictFieldScore(project.problem, {
    minWords: 55,
    markers: /gap|problem|challenge|need|lack|insufficient|without|difficulty|miss/i
  });
  const methodScore = strictFieldScore(project.method, {
    minWords: 70,
    markers: /workflow|step|input|output|agent|prototype|system|implement|generate|review|revise/i
  });
  const evaluationScore = strictFieldScore(project.evaluation, {
    minWords: 55,
    markers: /metric|baseline|compare|measure|rubric|success|failure|criteria|coverage|score/i
  });
  const timelineScore = strictFieldScore(project.timeline, {
    minWords: 30,
    markers: /phase|week|month|milestone|deliverable|deadline|stage|iteration/i
  });
  const resourcesScore = strictFieldScore(project.resources, {
    minWords: 30,
    markers: /software|tool|data|compute|api|server|budget|time|review|resource|cost/i
  });
  const researchQuality = clamp(Math.round((problemScore * 0.35) + (methodScore * 0.3) + (evaluationScore * 0.25) + (timelineScore * 0.1)));
  const clarity = strictClarityScore({ wordCount, sentenceStats, project });
  const technical = clamp(Math.round((methodScore * 0.45) + (evaluationScore * 0.25) + Math.min(uniqueTechnicalTerms(text) * 5, 30)));
  const referenceScore = strictReferenceScore(project.references, references);
  const completionScore = clamp(completion);
  const unresolvedPenalty = totalRows ? Math.max(0, totalRows - coveredRows) * 2 : 12;
  const overall = clamp(Math.round(
    (researchQuality * 0.28) +
    (clarity * 0.14) +
    (technical * 0.2) +
    (referenceScore * 0.18) +
    (completionScore * 0.2) -
    unresolvedPenalty
  ));
  const grade = gradeForScore(overall);
  const readinessChecklist = [
    ['Clear research gap with evidence', problemScore >= 70],
    ['Concrete method/workflow', methodScore >= 70],
    ['Metrics, baselines, and success criteria', evaluationScore >= 70],
    ['Timeline with dated milestones', timelineScore >= 65],
    ['Resources/budget with implementation needs', resourcesScore >= 65],
    ['Five or more credible source notes', referenceScore >= 70],
    ['Strict matrix at least 80% covered', completionScore >= 80]
  ];
  const readinessMet = readinessChecklist.filter(([, met]) => met).length;

  return {
    summary: `Strict score ${overall}/100. This score requires substantive fields, measurable evaluation evidence, source grounding, and strict matrix coverage.`,
    scores: { overall, grade, gradeColor: gradeColor(grade) },
    dimensionScores: [
      { label: 'Research Quality', score: researchQuality, note: 'Strict gate for gap, method, evaluation, and timeline specificity.' },
      { label: 'Clarity', score: clarity, note: 'Rewards complete, readable sections and penalizes thin or awkward drafts.' },
      { label: 'Technical Depth', score: technical, note: 'Requires workflow detail, evaluation hooks, and technical vocabulary.' },
      { label: 'References', score: referenceScore, note: 'Requires credible source notes, years, URLs/DOIs, or named papers.' },
      { label: 'Completion', score: completionScore, note: `${coveredRows}/${totalRows || 0} strict checklist items covered.` }
    ],
    graduateReadiness: {
      readinessPercent: Math.round((readinessMet / readinessChecklist.length) * 100),
      readinessLevel: readinessMet >= 6 ? 'Ready for serious revision' : readinessMet >= 4 ? 'Promising but not submission-ready' : 'Needs major development',
      checklist: readinessChecklist.map(([name, met]) => ({ name, met }))
    },
    languageAnalysis: {
      academicTone: clamp(Math.round(40 + countMatches(text, /evaluate|proposal|method|evidence|research|workflow|criteria|baseline|metric|claim|source/gi) * 2)),
      technicalTermCount: technicalTerms,
      readability: clarity,
      averageSentenceLength: sentenceStats.averageLength,
      note: wordCount >= 450 ? 'The draft has enough length for strict review; now verify claims, citations, and metrics.' : 'Strict review considers this draft thin. Add concrete claims, evidence, metrics, and source notes.'
    },
    referenceAnalysis: {
      count: references.length,
      quality: referenceScore >= 85 ? 'Strong' : referenceScore >= 70 ? 'Developing' : 'Needs more credible sources',
      suggestions: referenceScore >= 70
        ? ['Tie each source to a specific claim, metric, or design choice.', 'Verify authors, years, URLs/DOIs, and relevance before final submission.']
        : ['Add at least five relevant papers or proposal-writing sources.', 'Include authors, years, URLs/DOIs, and notes explaining how each source supports a claim.']
    },
    recommendations: buildRecommendations({
      project,
      references,
      overall,
      completionScore,
      technical,
      clarity,
      scores: { problemScore, methodScore, evaluationScore, timelineScore, resourcesScore, referenceScore }
    })
  };
}

function buildRecommendations({ references, overall, completionScore, technical, clarity, scores }) {
  const recommendations = [];
  if (scores.problemScore < 70) recommendations.push({ priority: 'High', area: 'Problem/GAP', message: 'Add a sharper research gap, affected users, and evidence that current approaches are insufficient.' });
  if (scores.methodScore < 70) recommendations.push({ priority: 'High', area: 'Method', message: 'Describe workflow steps, inputs/outputs, human checkpoints, implementation choices, and failure handling.' });
  if (scores.evaluationScore < 70) recommendations.push({ priority: 'High', area: 'Evaluation', message: 'Add concrete metrics, comparison baselines, success thresholds, and failure criteria.' });
  if (references.length < 5) recommendations.push({ priority: 'High', area: 'References', message: 'Add at least five credible source notes with authors, years, URLs/DOIs, and claim links.' });
  if (technical < 70) recommendations.push({ priority: 'Medium', area: 'Technical Depth', message: 'Describe the agent workflow, data flow, and review loop in more detail.' });
  if (clarity < 75) recommendations.push({ priority: 'Medium', area: 'Clarity', message: 'Shorten long sentences and make each section start with a clear claim.' });
  if (scores.timelineScore < 65) recommendations.push({ priority: 'Medium', area: 'Timeline', message: 'Add week/month milestones, deliverables, and a feasible order of work.' });
  if (scores.resourcesScore < 65) recommendations.push({ priority: 'Medium', area: 'Resources', message: 'List concrete tools, data, compute/API needs, review time, and budget assumptions.' });
  if (completionScore < 80) recommendations.push({ priority: 'High', area: 'Completion', message: 'Resolve every strict matrix row marked Needs work before submitting.' });
  if (overall >= 85) recommendations.push({ priority: 'Low', area: 'Polish', message: 'The draft is strong under strict review; focus on citations, examples, and final proofreading.' });
  return recommendations.slice(0, 5);
}

function strictFieldScore(value, { minWords, markers }) {
  const text = String(value || '');
  const words = countWords(text);
  if (!words) return 0;

  const lengthScore = clamp(Math.round(Math.min(words / minWords, 1) * 65));
  const markerScore = markers?.test(text) ? 25 : 0;
  const specificityScore = countMatches(text, /\b(?:\d+|metric|baseline|dataset|source|claim|phase|week|month|criterion|criteria|evidence|compare)\b/gi) >= 2 ? 10 : 0;

  return clamp(lengthScore + markerScore + specificityScore);
}

function strictClarityScore({ wordCount, sentenceStats, project }) {
  const completedFields = PROJECT_FIELD_PAIRS.filter(([field]) => countWords(project[field]) >= 25).length;
  const completeness = Math.round((completedFields / PROJECT_FIELD_PAIRS.length) * 45);
  const lengthScore = wordCount >= 450 ? 25 : wordCount >= 300 ? 18 : wordCount >= 180 ? 10 : 4;
  const sentenceScore = sentenceStats.averageLength >= 12 && sentenceStats.averageLength <= 28
    ? 30
    : sentenceStats.averageLength > 0
      ? 14
      : 0;

  return clamp(completeness + lengthScore + sentenceScore);
}

function strictReferenceScore(rawReferences, references) {
  const referenceText = String(rawReferences || '');
  const countScore = Math.min(references.length * 10, 50);
  const metadataHits = countMatches(referenceText, /\b(?:19|20)\d{2}\b|doi|https?:|et al\.|journal|conference|proceedings/gi);
  const metadataScore = Math.min(metadataHits * 8, 35);
  const claimLinkScore = /claim|supports|evidence|because|used for|source note|ground/i.test(referenceText) ? 15 : 0;

  return clamp(countScore + metadataScore + claimLinkScore);
}

function extractReferences(value) {
  return String(value || '').split(/\n|;/).map((item) => item.trim()).filter((item) => item.length > 18);
}

function countTechnicalTerms(text) {
  return countMatches(text, /agent|workflow|evaluation|citation|retrieval|proposal|matrix|latex|pdf|model|source|rubric|prototype|revision|grounding/gi);
}

function uniqueTechnicalTerms(text) {
  const terms = String(text || '').toLowerCase().match(/agent|workflow|evaluation|citation|retrieval|proposal|matrix|latex|pdf|model|source|rubric|prototype|revision|grounding|baseline|metric|architecture|pipeline/g) || [];
  return new Set(terms).size;
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
