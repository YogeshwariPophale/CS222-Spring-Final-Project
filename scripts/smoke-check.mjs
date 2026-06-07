import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { proposalLatexToPdf } from '../server/pdfExport.js';
import { generateProposal, startAgentSession } from '../server/proposalGenerator.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const topic = 'Citation-grounded agent for literature review workflows';

console.log('Running server generator smoke check...');
const session = await startAgentSession({ topic });
assert(session.project?.title, 'Agent session did not return a project title.');
assert(Array.isArray(session.fieldSuggestions) && session.fieldSuggestions.length > 0, 'Agent session did not return field suggestions.');
assert(Array.isArray(session.decisions), 'Agent session did not return a decisions array.');

const proposal = await generateProposal({ ...session.project, topic: session.project.topic || session.project.title });
assert(proposal.proposalLatex?.includes('\\begin{document}'), 'Generated proposal is missing a LaTeX document body.');
assert(Array.isArray(proposal.complianceMatrix) && proposal.complianceMatrix.length > 0, 'Generated proposal is missing compliance rows.');
assert(typeof proposal.evaluationReport === 'string' && proposal.evaluationReport.length > 20, 'Generated proposal is missing an evaluation report.');

console.log('Running PDF fallback smoke check...');
const pdf = await proposalLatexToPdf(proposal.proposalLatex, proposal.project?.title || 'proposal');
assert(Buffer.isBuffer(pdf), 'PDF export did not return a Buffer.');
assert(pdf.slice(0, 5).toString() === '%PDF-', 'PDF export did not return a PDF buffer.');

console.log('Running React render smoke check...');
const vite = await createServer({
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true }
});

try {
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  const html = renderToString(React.createElement(App));
  assert(html.includes('Research Proposal Agent'), 'React render is missing the app title.');
  assert(html.includes('Structure Idea'), 'React render is missing the structure action.');
  assert(html.includes('Analysis'), 'React render is missing the Analysis tab.');
} finally {
  await vite.close();
}

console.log('Smoke check passed: server, PDF export, and React shell render correctly.');
