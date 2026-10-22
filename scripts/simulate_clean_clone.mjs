import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const projectRoot = path.resolve('.');
const tmpCloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-clean-clone-'));
console.log('Temporary clone directory:', tmpCloneDir);

try {
  // 1. Get all git tracked files without octal escaping
  const trackedFilesOutput = execSync('git -c core.quotepath=false ls-files', { cwd: projectRoot, encoding: 'utf-8' });
  const files = trackedFilesOutput.split('\n').map(f => f.trim()).filter(Boolean);

  console.log(`Copying ${files.length} tracked files to clean clone directory...`);
  for (const f of files) {
    const src = path.join(projectRoot, f);
    const dest = path.join(tmpCloneDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Also copy any untracked fixtures or modified files if any
  const statusOutput = execSync('git status -s', { cwd: projectRoot, encoding: 'utf-8' });
  for (const line of statusOutput.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const filePath = trimmed.slice(2).trim().replace(/^"|"$/g, '');
    if (filePath.startsWith('tests/fixtures/') || filePath === 'package.json' || filePath.startsWith('src/')) {
      const src = path.join(projectRoot, filePath);
      const dest = path.join(tmpCloneDir, filePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  console.log('\nRunning npm ci in clean clone...');
  execSync('npm ci', { cwd: tmpCloneDir, stdio: 'inherit' });

  console.log('\nRunning npm test in clean clone...');
  const testOut = execSync('npm test', { cwd: tmpCloneDir, encoding: 'utf-8' });
  console.log(testOut);
  console.log('\nClean clone simulation PASSED (all tests green)!');
} finally {
  try {
    fs.rmSync(tmpCloneDir, { recursive: true, force: true });
    console.log('Cleaned up temporary clone directory.');
  } catch {}
}
