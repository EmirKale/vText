import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const testFile = path.join(os.tmpdir(), 'vtext_lock_test.txt');
const tmpFile = path.join(os.tmpdir(), 'vtext_lock_test.tmp');
fs.writeFileSync(testFile, 'original content');
fs.writeFileSync(tmpFile, 'new content');

const psCmd = `$stream = [System.IO.File]::Open('${testFile.replace(/\\/g, '\\\\')}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read); Write-Output 'READY'; Start-Sleep -Seconds 15; $stream.Close();`;

const ps = spawn('powershell.exe', ['-NoProfile', '-Command', psCmd]);

ps.stdout.on('data', (data) => {
  const str = data.toString();
  if (str.includes('READY')) {
    try {
      fs.renameSync(tmpFile, testFile);
      console.log('RESULT: RENAME_SUCCESS');
    } catch (err) {
      console.log('RESULT: RENAME_FAILED');
      console.log('RAW_ERROR_CODE:', err.code);
      console.log('RAW_ERROR_SYSCALL:', err.syscall);
      console.log('RAW_ERROR_ERRNO:', err.errno);
      console.log('RAW_ERROR_MESSAGE:', err.message);
    } finally {
      ps.kill();
      try { fs.unlinkSync(testFile); } catch {}
      try { fs.unlinkSync(tmpFile); } catch {}
      process.exit(0);
    }
  }
});

ps.stderr.on('data', (data) => {
  console.error('PS_ERROR:', data.toString());
});
