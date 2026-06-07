# Local Repair Guide for VS Code / GitHub Desktop

Use this guide when the app works in GitHub but your local VS Code copy shows parse errors such as:

- `Identifier TARGET_LANGUAGE_OPTIONS has already been declared`
- `Identifier response has already been declared`
- `SyntaxError: Unexpected identifier 'writeFile'` in `server/pdfExport.js`
- `Failed to execute 'json' on 'Response': Unexpected end of JSON input`

These errors usually mean local files were pasted or merged twice. The clean repository version should have only one `TARGET_LANGUAGE_OPTIONS` block in `src/App.jsx`, one `postJson` helper, and one `exportPdfUrl` helper.

## Quick fix when you do not need to keep local edits

Run this command first. It restores the known project files from Git and checks that the app builds:

```powershell
npm.cmd run repair:local
```

Then start the site:

```powershell
npm.cmd run dev
```

If the repair script is not available in your local copy yet, run these manual commands instead:

```powershell
git status
git restore src/App.jsx server/pdfExport.js server/proposalGenerator.js src/index.css README.md docs/WORK_NOTES.md docs/stage_1_demo_artifact.md docs/local_repair_guide.md
Run these commands in PowerShell from the repository folder:

```powershell
git status
git restore src/App.jsx server/pdfExport.js server/proposalGenerator.js README.md docs/WORK_NOTES.md docs/stage_1_demo_artifact.md
npm.cmd install
npm.cmd run dev
```

Then open:

```text
http://127.0.0.1:5174/
```

## Full reset to match GitHub exactly

Only use this if you do **not** need to keep any local edits.

```powershell
git fetch origin
git reset --hard origin/main
npm.cmd install
npm.cmd run dev
```

If your default branch is named `master` instead of `main`, use this instead:

```powershell
git reset --hard origin/master
```

## GitHub Desktop steps

1. Open the repository in GitHub Desktop.
2. Go to **Changes**.
3. If `src/App.jsx` or `server/pdfExport.js` shows pasted duplicate code, right-click the file and choose **Discard changes**.
4. Click **Fetch origin**.
5. Click **Pull origin** if GitHub Desktop shows that updates are available.
6. Return to VS Code and run `npm.cmd run dev` again.

## How to check the clean files

In the clean version:

- `server/pdfExport.js` imports `writeFile` at the top from `node:fs/promises` and writes the `.tex` file inside `proposalLatexToPdf`.
- `src/App.jsx` has a single target-language dropdown list.
- `src/App.jsx` does not contain merge markers such as `<<<<<<<`, `=======`, or `>>>>>>>`.
- `src/App.jsx` does not contain duplicated `import { useEffect... }` blocks.

If any of those are wrong, restore the file from Git/GitHub instead of manually editing around the error.
