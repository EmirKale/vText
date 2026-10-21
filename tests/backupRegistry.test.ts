import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  setCustomBackupRegistryPath,
  getBackupRegistryPath,
  loadBackupRegistry,
  saveBackupRegistry,
  recordFileSavedByVText,
  isFileLastWrittenByVText,
  computeBufferSha256
} from '../src/main/backupRegistry';
import { openFileByPath, saveFile, resetBackupTracker } from '../src/main/files';
import { documentRegistry } from '../src/main/registry';

describe('GRUP D: Yedek Gürültüsü & Persistent Hash Kayıt Defteri', () => {
  let tmpDir: string;
  let testRegPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-backup-test-'));
    testRegPath = path.join(tmpDir, 'backup-hash-registry.json');
    setCustomBackupRegistryPath(testRegPath);
    resetBackupTracker();
  });

  afterEach(() => {
    setCustomBackupRegistryPath(null);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Harici dosya ilk kez kaydedildiğinde orijinalin yedeği alınmalı ve kayıt defterine yazılmalıdır', async () => {
    const extDocx = path.join(tmpDir, 'harici_belge.txt');
    fs.writeFileSync(extDocx, 'Harici program tarafından oluşturulan metin.', 'utf8');

    // Dosyayı vText ile aç
    const openRes = await openFileByPath(extDocx);
    expect(openRes.success).toBe(true);

    const entry = documentRegistry.get(openRes.docId!);
    expect(entry).toBeDefined();
    expect(entry?.wasLastSavedByVText).toBe(false);

    // İlk Ctrl+S kaydı
    const saveRes = await saveFile(openRes.docId!, 'vText tarafından güncellenen içerik.');
    expect(saveRes.success).toBe(true);
    expect(saveRes.backupFileName).toBe('harici_belge (vText öncesi yedek).txt');

    const backupPath = path.join(tmpDir, 'harici_belge (vText öncesi yedek).txt');
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(fs.readFileSync(backupPath, 'utf8')).toBe('Harici program tarafından oluşturulan metin.');

    // Kayıt defterine yeni SHA-256 yazılmış olmalı
    const reg = loadBackupRegistry();
    expect(Object.keys(reg).length).toBe(1);
    expect(isFileLastWrittenByVText(extDocx)).toBe(true);
  });

  it('2. vText\'in yazdığı dosya kapatılıp tekrar açıldığında yeni yedek ALINMAMALIDIR', async () => {
    const myDoc = path.join(tmpDir, 'vtext_belge.txt');
    fs.writeFileSync(myDoc, 'İlk içerik.', 'utf8');

    // İlk açılış ve kayıt
    const open1 = await openFileByPath(myDoc);
    await saveFile(open1.docId!, 'vText tarafından kaydedilen birinci sürüm.');

    const backup1 = path.join(tmpDir, 'vtext_belge (vText öncesi yedek).txt');
    expect(fs.existsSync(backup1)).toBe(true);

    // Oturumu sıfırla (uygulama kapatıldı, açıldı benzetimi)
    resetBackupTracker();
    documentRegistry.clear();

    // vText'in yazdığı dosyayı tekrar aç
    const open2 = await openFileByPath(myDoc);
    expect(open2.success).toBe(true);
    const entry2 = documentRegistry.get(open2.docId!);
    expect(entry2?.wasLastSavedByVText).toBe(true);

    // Tekrar kaydet
    const save2 = await saveFile(open2.docId!, 'vText tarafından kaydedilen ikinci sürüm.');
    expect(save2.success).toBe(true);

    // Yeni yedek oluşturulmamalıdır!
    expect(save2.backupFileName).toBeUndefined();
    const backup2 = path.join(tmpDir, 'vtext_belge (vText öncesi yedek 2).txt');
    expect(fs.existsSync(backup2)).toBe(false);
  });

  it('3. Dosyayı harici bir program değiştirirse tekrar açıldığında yeniden YEDEK ALINMALIDIR', async () => {
    const myDoc = path.join(tmpDir, 'degisen_belge.txt');
    fs.writeFileSync(myDoc, 'İlk içerik.', 'utf8');

    // İlk açılış ve kayıt
    const open1 = await openFileByPath(myDoc);
    await saveFile(open1.docId!, 'vText içeriği.');

    // Oturumu sıfırla
    resetBackupTracker();
    documentRegistry.clear();

    // Harici program dosyayı değiştirsin
    fs.writeFileSync(myDoc, 'Harici program dosyayı değiştirdi!', 'utf8');

    // Tekrar aç
    const open2 = await openFileByPath(myDoc);
    expect(open2.success).toBe(true);
    const entry2 = documentRegistry.get(open2.docId!);
    expect(entry2?.wasLastSavedByVText).toBe(false);

    // Kaydet -> Yeniden yedek alınmalı!
    const save2 = await saveFile(open2.docId!, 'vText yeni içerik.');
    expect(save2.success).toBe(true);
    expect(save2.backupFileName).toBe('degisen_belge (vText öncesi yedek 2).txt');

    const backup2 = path.join(tmpDir, 'degisen_belge (vText öncesi yedek 2).txt');
    expect(fs.existsSync(backup2)).toBe(true);
    expect(fs.readFileSync(backup2, 'utf8')).toBe('Harici program dosyayı değiştirdi!');
  });

  it('4. Kayıt defteri bozuksa veya yoksa güvenli tarafta kalınarak yedek alınmalıdır', async () => {
    const myDoc = path.join(tmpDir, 'bozuk_reg_belge.txt');
    fs.writeFileSync(myDoc, 'İçerik.', 'utf8');

    // Bozuk JSON yaz
    fs.writeFileSync(testRegPath, '{ bozuk json !!!', 'utf8');

    const openRes = await openFileByPath(myDoc);
    const entry = documentRegistry.get(openRes.docId!);
    expect(entry?.wasLastSavedByVText).toBe(false);

    const saveRes = await saveFile(openRes.docId!, 'Yeni içerik.');
    expect(saveRes.success).toBe(true);
    expect(saveRes.backupFileName).toBe('bozuk_reg_belge (vText öncesi yedek).txt');
  });
});
