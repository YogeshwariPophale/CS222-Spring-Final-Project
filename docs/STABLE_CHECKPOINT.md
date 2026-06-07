# Stable Checkpoint

This checkpoint records the last known working version of the local proposal-agent app.

## Checkpoint commit

- Commit: `06a9c8f`
- Name: `stable-local-demo-2026-06-07`
- Date recorded: 2026-06-07

## What is working at this checkpoint

- `npm.cmd run check:app` completes successfully.
- `npm.cmd run dev` starts both services.
- The API terminal shows `Proposal API listening on http://127.0.0.1:8787`.
- The website opens at `http://127.0.0.1:5174/`.
- The Sample / Structure Idea flow works.
- Proposal generation works.
- PDF export works through the built-in fallback renderer when a local LaTeX compiler is unavailable.

## Restore this checkpoint locally

If future edits break the app, run these commands from the project folder in PowerShell:

```powershell
git status
git restore src/App.jsx server/pdfExport.js server/proposalGenerator.js src/index.css package.json README.md docs/WORK_NOTES.md docs/local_repair_guide.md docs/stage_1_demo_artifact.md scripts/restore-clean-files.mjs
npm.cmd run check:app
npm.cmd run dev
```

If you want to reset the whole repository back to this exact checkpoint and do not need to keep local edits, run:

```powershell
git reset --hard 06a9c8f
npm.cmd install
npm.cmd run check:app
npm.cmd run dev
```

## Before making new changes

Create a branch or commit first so this working state is easy to recover:

```powershell
git status
git add .
git commit -m "Checkpoint before new changes"
```
