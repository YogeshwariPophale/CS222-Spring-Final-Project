import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function proposalLatexToPdf(latex, title = 'proposal') {
  const source = String(latex || '').trim();

  if (!source) {
    throw new Error('LaTeX source is empty.');
  }

  const workdir = await mkdtemp(path.join(tmpdir(), 'proposal-tex-'));
  const texPath = path.join(workdir, 'proposal.tex');
  const pdfPath = path.join(workdir, 'proposal.pdf');

  try {
    const preparedLatex = sanitizeLatexForExport(ensureCompleteLatexDocument(source, title));
    await writeFile(texPath, preparedLatex, 'utf8');

    try {
      await execFileAsync('tectonic', ['--outdir', workdir, texPath], {
        cwd: workdir,
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 8
      });

      return await readFile(pdfPath);
    } catch (compileError) {
      return renderFallbackPdf({
        latex: preparedLatex,
        title,
        reason: compileError instanceof Error ? compileError.message : String(compileError)
      });
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function renderFallbackPdf({ latex, title, reason }) {
  const lines = latexToPlainText(latex, title, reason);
  const pages = paginateLines(lines, 54);
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];

  pages.forEach((pageLines) => {
    const content = buildPageContent(pageLines);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  return Buffer.from(serializePdf(objects), 'binary');
}

function latexToPlainText(latex, title, reason) {
  const body = String(latex || '')
    .replace(/\\begin\{document\}|\\end\{document\}/g, '')
    .replace(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/g, '')
    .replace(/\\usepackage(?:\[[^\]]*\])?\{[^}]+\}/g, '')
    .replace(/\\setlist\{[^}]+\}/g, '')
    .replace(/\\title\{([^}]*)\}/g, 'Title: $1\n')
    .replace(/\\section\{([^}]*)\}/g, '\n$1\n')
    .replace(/\\subsection\{([^}]*)\}/g, '\n$1\n')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\texttt\{([^}]*)\}/g, '$1')
    .replace(/\\item\s+/g, '- ')
    .replace(/\\(?:begin|end)\{[^}]+\}/g, '')
    .replace(/\\[a-zA-Z]+(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const header = [
    title || 'proposal',
    'PDF preview generated with the built-in fallback renderer.',
    `LaTeX compiler note: ${String(reason || 'tectonic unavailable').slice(0, 180)}`,
    ''
  ];

  return [...header, ...wrapText(body, 92)];
}

function wrapText(text, width) {
  const output = [];

  String(text || '').split(/\n/).forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      output.push('');
      return;
    }

    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width) {
        output.push(line);
        line = word;
      } else {
        line = next;
      }
    });

    if (line) output.push(line);
  });

  return output;
}

function paginateLines(lines, perPage) {
  const pages = [];
  for (let index = 0; index < lines.length; index += perPage) {
    pages.push(lines.slice(index, index + perPage));
  }
  return pages.length ? pages : [['No proposal content was available.']];
}

function buildPageContent(lines) {
  const commands = ['BT', '/F1 10 Tf', '50 750 Td', '14 TL'];

  lines.forEach((line, index) => {
    if (index > 0) commands.push('T*');
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push('ET');
  return commands.join('\n');
}

function serializePdf(objects) {
  const parts = ['%PDF-1.4\n'];
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(parts.join(''), 'binary'));
    parts.push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(parts.join(''), 'binary');
  parts.push(`xref\n0 ${objects.length + 1}\n`);
  parts.push('0000000000 65535 f \n');
  offsets.slice(1).forEach((offset) => {
    parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  });
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return parts.join('');
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function sanitizeLatexForExport(source) {
  return replaceExternalImageIncludes(source);
}

function replaceExternalImageIncludes(source) {
  return String(source || '').replace(
    /\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^{}]+)\}/g,
    (_, filename) => imagePlaceholder(filename)
  );
}

function imagePlaceholder(filename) {
  return String.raw`\begin{center}
\fbox{\begin{minipage}{0.86\linewidth}
\centering
\textbf{Workflow diagram}\\[0.45em]
Rough idea $\rightarrow$ structured state $\rightarrow$ student decisions $\rightarrow$ proposal draft $\rightarrow$ compliance review $\rightarrow$ revised PDF\\[0.45em]
\footnotesize External image asset \texttt{${escapeLatex(filename)}} was not provided, so the exporter rendered this LaTeX-native placeholder.
\end{minipage}}
\end{center}`;
}

function ensureCompleteLatexDocument(source, title) {
  if (/\\documentclass\b/.test(source) && /\\begin\{document\}/.test(source)) {
    return normalizeCompleteLatexDocument(source);
  }

  return String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[hidelinks]{hyperref}
\usepackage{enumitem}
\setlist{nosep}
\title{${escapeLatex(title)}}
\author{}
\date{}
\begin{document}
\maketitle
${source}
\end{document}
`;
}

function normalizeCompleteLatexDocument(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const beginIndex = lines.findIndex((line) => /\\begin\{document\}/.test(line));
  const endIndex = findLastIndex(lines, (line) => /\\end\{document\}/.test(line));

  if (beginIndex === -1) {
    return source;
  }

  const preambleLines = lines.slice(0, beginIndex);
  const bodyLines = lines.slice(beginIndex + 1, endIndex === -1 ? lines.length : endIndex);
  const documentClass = preambleLines.find((line) => /\\documentclass\b/.test(line)) || '\\documentclass[11pt]{article}';
  const preamble = [];
  const movedPreamble = [];

  preambleLines.forEach((line) => {
    if (/\\documentclass\b/.test(line)) return;
    if (/\\begin\{document\}|\\end\{document\}/.test(line)) return;
    preamble.push(line);
  });

  const cleanBody = bodyLines.filter((line) => {
    if (/\\documentclass\b|\\begin\{document\}|\\end\{document\}/.test(line)) return false;
    if (/^\s*\\(?:usepackage|geometry)\b/.test(line)) {
      movedPreamble.push(line);
      return false;
    }
    return true;
  });

  const normalizedPreamble = ensureDefaultPreamble([documentClass, ...preamble, ...movedPreamble]);

  return `${dedupeLines(normalizedPreamble).join('\n')}\n\\begin{document}\n${cleanBody.join('\n').trim()}\n\\end{document}\n`;
}

function ensureDefaultPreamble(lines) {
  const source = lines.join('\n');
  const next = [...lines];

  if (!/\\usepackage(?:\[[^\]]*\])?\{geometry\}/.test(source)) {
    next.push('\\usepackage[margin=1in]{geometry}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{hyperref\}/.test(source)) {
    next.push('\\usepackage[hidelinks]{hyperref}');
  }

  if (!/\\usepackage(?:\[[^\]]*\])?\{enumitem\}/.test(source)) {
    next.push('\\usepackage{enumitem}');
  }

  return next;
}

function dedupeLines(lines) {
  const seen = new Set();

  return lines.filter((line) => {
    const key = line.trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }

  return -1;
}

function escapeLatex(value) {
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