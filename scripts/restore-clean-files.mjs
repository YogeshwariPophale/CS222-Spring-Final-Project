import { execFileSync } from 'node:child_process';

const filesToRestore = [
  'src/App.jsx',
  'src/main.jsx',
  'server/pdfExport.js',
  'server/proposalGenerator.js',
  'src/index.css',
  'README.md',
  'docs/WORK_NOTES.md',
  'docs/stage_1_demo_artifact.md',
  'docs/local_repair_guide.md',
  'docs/STABLE_CHECKPOINT.md',
  'scripts/smoke-check.mjs',
  'package.json'
  'docs/local_repair_guide.md'
];

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

console.log('Restoring known project files from the current Git commit...');
console.log('This removes accidental pasted duplicates, merge markers, and half-applied edits in the listed files.');

run('git', ['restore', '--staged', '--worktree', '--source=HEAD', '--', ...filesToRestore]);

console.log('\nChecking that the repaired app can compile...');
run('node', ['--check', 'server/pdfExport.js']);
run('node', ['--check', 'server/proposalGenerator.js']);
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'smoke:app']);

console.log('\nRepair complete. Now run:');
console.log('  npm.cmd run dev');
console.log('Then open:');
console.log('  http://127.0.0.1:5174/');
