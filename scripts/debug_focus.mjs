import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-debug-focus-'));
const app = await electron.launch({
  args: ['./out/main/index.js', '--user-data-dir=' + tmpUserData],
  cwd: path.resolve('.')
});
const page = await app.firstWindow();
await page.waitForSelector('.ProseMirror');
await page.waitForTimeout(1000);

// Test clicking editor directly
await page.locator('.ProseMirror').click({ force: true });
console.log('1. After editor click activeElement:', await page.evaluate(() => document.activeElement?.className));

// Click block dropdown trigger
const blockBtn = page.locator('button[aria-haspopup="menu"]').first();
await blockBtn.click({ force: true });
console.log('2. After dropdown open activeElement:', await page.evaluate(() => document.activeElement?.className));

// Click 'Başlık 1'
const h1Item = page.locator('button[role="menuitem"]:has-text("Başlık 1")');
await h1Item.click({ force: true });
await page.waitForTimeout(300);

console.log('3. After h1 select activeElement:', await page.evaluate(() => ({
  tag: document.activeElement?.tagName,
  class: document.activeElement?.className,
  isPM: document.activeElement?.classList.contains('ProseMirror')
})));

// Now type immediately
await page.keyboard.type('Test Metni');
console.log('4. Editor text content:', await page.locator('.ProseMirror').innerText());

await app.close();
fs.rmSync(tmpUserData, { recursive: true, force: true });
