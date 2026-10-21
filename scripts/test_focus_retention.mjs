import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';

const projectRoot = path.resolve('.');
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-focus-test-'));

console.log('Testing toolbar menus focus retention...');
const app = await electron.launch({
  args: ['./out/main/index.js', `--user-data-dir=${tmpUserData}`],
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    ELECTRON_ENABLE_LOGGING: '1'
  }
});

const page = await app.firstWindow();
await page.waitForSelector('.ProseMirror', { timeout: 15000 });
await page.waitForTimeout(1000);

// Helper to check active element
async function getActiveElementInfo() {
  return await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { tagName: 'null', className: '', isProseMirror: false };
    const isPM = el.classList.contains('ProseMirror') || el.closest('.ProseMirror') !== null;
    return {
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      isProseMirror: isPM
    };
  });
}

const results = {};

// 1. Initial State (after launch and autofocus)
results['1_initial'] = await getActiveElementInfo();

// 2. Paragraf / Başlık Menu
console.log('Testing Block/Heading menu...');
await page.locator('button[aria-haspopup="menu"]').first().click({ force: true });
await page.waitForTimeout(150);
await page.locator('button[role="menuitem"]:has-text("Başlık 1")').first().click({ force: true });
await page.waitForTimeout(200);
results['2_block_menu_h1'] = await getActiveElementInfo();

// 3. Yazı Tipi (Font) Menu
console.log('Testing Font menu...');
await page.locator('button[title="Yazı tipi"]').click({ force: true });
await page.waitForTimeout(150);
await page.locator('button[role="menuitem"]:has-text("Arial")').click({ force: true });
await page.waitForTimeout(200);
results['3_font_menu_arial'] = await getActiveElementInfo();

// 4. Punto (Size) Menu
console.log('Testing Size menu...');
await page.locator('button[aria-label="Boyut listesi"]').click({ force: true });
await page.waitForTimeout(150);
await page.locator('button[role="menuitem"]:has-text("16")').click({ force: true });
await page.waitForTimeout(200);
results['4_size_menu_16'] = await getActiveElementInfo();

// 5. Liste Düğmesi
console.log('Testing Bullet List button...');
await page.locator('button[title="Madde işaretli liste"]').click({ force: true });
await page.waitForTimeout(200);
results['5_bullet_list_btn'] = await getActiveElementInfo();

// 6. Hizalama Düğmesi
console.log('Testing Alignment button...');
await page.locator('button[title="Ortala"]').click({ force: true });
await page.waitForTimeout(200);
results['6_align_center_btn'] = await getActiveElementInfo();

// 7. Renk (Color) Menu
console.log('Testing Color menu...');
await page.locator('button[title="Yazı rengi"]').click({ force: true });
await page.waitForTimeout(150);
await page.locator('button[title="#C0392B"]').click({ force: true });
await page.waitForTimeout(200);
results['7_color_menu'] = await getActiveElementInfo();

// 8. Vurgu (Highlight) Menu
console.log('Testing Highlight menu...');
await page.locator('button[title="Vurgu rengi"]').click({ force: true });
await page.waitForTimeout(150);
await page.locator('button[title="#FFF59D"]').click({ force: true });
await page.waitForTimeout(200);
results['8_highlight_menu'] = await getActiveElementInfo();

console.log('FOCUS RETENTION RESULTS:\n', JSON.stringify(results, null, 2));

await app.close();
fs.rmSync(tmpUserData, { recursive: true, force: true });
