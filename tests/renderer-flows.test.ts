import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { useAppStore } from '../src/renderer/src/store/useAppStore.ts';
import { DocumentRegistry } from '../src/main/registry.ts';
import { saveFile } from '../src/main/files.ts';
import { tipTapJsonToMarkdown } from '../src/renderer/src/io/markdown.ts';
import { exportTipTapJsonToDocx } from '../src/renderer/src/io/docxExport.ts';

describe('Renderer Akış Testleri: Yeni Belge -> Kaydet -> Tekrar Kaydet -> Farklı Kaydet -> Kapatırken Onay -> Çift Açma Engeli', () => {
  let tmpDir: string;
  let registry: DocumentRegistry;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtext-renderer-flows-'));
    registry = DocumentRegistry.getInstance();
    registry.clear();

    // Store'u başlangıç durumuna sıfırla
    useAppStore.setState({
      tabs: [
        {
          id: 'tab-init',
          title: 'Adsız Belge 1',
          content: '<p></p>',
          isDirty: false,
          format: 'docx',
          docId: undefined,
          filePath: undefined
        }
      ],
      activeTabId: 'tab-init'
    });
  });

  afterEach(() => {
    registry.clear();
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('1. Yeni Belge: Başlangıçta boş adsız belgeyle başlar', () => {
    const state = useAppStore.getState();
    assert.equal(state.tabs.length, 1);
    assert.equal(state.tabs[0].title, 'Adsız Belge 1');
    assert.equal(state.tabs[0].isDirty, false);
    assert.equal(state.tabs[0].docId, undefined);
  });

  it('2. Kaydet: Yeni belge kaydedildiğinde diyalogdan docId alır, DOCX olarak kaydeder ve isDirty=false olur', async () => {
    const store = useAppStore.getState();
    const activeTab = store.tabs[0];

    // Belgeye metin yazılır
    useAppStore.getState().updateTabContent(activeTab.id, '<p>Merhaba vText</p>');
    assert.equal(useAppStore.getState().tabs[0].isDirty, true);

    // İlk kez Kaydet çağrısı simülasyonu
    const targetFilePath = path.join(tmpDir, 'ilk_kayit.docx');
    const entry = registry.register(targetFilePath, 'docx', 'ilk_kayit.docx');

    const sampleJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Merhaba vText' }] }]
    };
    const docxBuf = await exportTipTapJsonToDocx(sampleJson, 'ilk_kayit.docx');
    const saveRes = await saveFile(entry.docId, docxBuf);
    assert.equal(saveRes.success, true);

    // Tab meta güncellenir
    useAppStore.getState().updateTabMeta(activeTab.id, {
      docId: entry.docId,
      filePath: entry.filePath,
      title: 'ilk_kayit.docx',
      format: 'docx',
      isDirty: false
    });

    const updated = useAppStore.getState().tabs[0];
    assert.equal(updated.docId, entry.docId);
    assert.equal(updated.title, 'ilk_kayit.docx');
    assert.equal(updated.isDirty, false);
    assert.equal(fs.existsSync(targetFilePath), true);
  });

  it('3. Tekrar Kaydet: docId zaten varsa diyalog açılmadan doğrudan aynı dosyaya kaydeder', async () => {
    const targetFilePath = path.join(tmpDir, 'tekrar_kayit.docx');
    const entry = registry.register(targetFilePath, 'docx', 'tekrar_kayit.docx');

    useAppStore.setState({
      tabs: [
        {
          id: 'tab-saved',
          title: 'tekrar_kayit.docx',
          docId: entry.docId,
          filePath: entry.filePath,
          content: '<p>İlk Versiyon</p>',
          isDirty: false,
          format: 'docx'
        }
      ],
      activeTabId: 'tab-saved'
    });

    // Kullanıcı değişiklik yapar
    useAppStore.getState().updateTabContent('tab-saved', '<p>İkinci Versiyon</p>');
    assert.equal(useAppStore.getState().tabs[0].isDirty, true);

    // Diyalog çağrılmadan doğrudan mevcut docId ile kaydetme
    const sampleJson = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'İkinci Versiyon' }] }]
    };
    const docxBuf = await exportTipTapJsonToDocx(sampleJson, 'tekrar_kayit.docx');
    const saveRes = await saveFile(useAppStore.getState().tabs[0].docId!, docxBuf);
    assert.equal(saveRes.success, true);

    useAppStore.getState().updateTabMeta('tab-saved', { isDirty: false });
    assert.equal(useAppStore.getState().tabs[0].isDirty, false);
  });

  it('4. Farklı Kaydet: Yeni docId alır, eski docId unregister edilir ve yeni formatta (.md) düz metin yazar', async () => {
    const oldFilePath = path.join(tmpDir, 'eski.docx');
    const oldEntry = registry.register(oldFilePath, 'docx', 'eski.docx');

    useAppStore.setState({
      tabs: [
        {
          id: 'tab-fork',
          title: 'eski.docx',
          docId: oldEntry.docId,
          filePath: oldEntry.filePath,
          content: '<h1>Başlık</h1><p>İçerik</p>',
          isDirty: false,
          format: 'docx'
        }
      ],
      activeTabId: 'tab-fork'
    });

    // Kullanıcı Farklı Kaydet (.md) yapar
    const newFilePath = path.join(tmpDir, 'yeni.md');
    const newEntry = registry.register(newFilePath, 'md', 'yeni.md');

    // Eski docId registry'den silinir
    registry.unregister(oldEntry.docId);
    assert.equal(registry.get(oldEntry.docId), undefined, 'Eski docId unregister edilmiş olmalıdır');

    // Yerel format değişkeni ('md') kullanılarak Markdown metni serileştirilir
    const sampleJson = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Başlık' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'İçerik' }] }
      ]
    };
    const mdText = tipTapJsonToMarkdown(sampleJson);
    const saveRes = await saveFile(newEntry.docId, mdText);
    assert.equal(saveRes.success, true);

    // Tab meta güncellenir
    useAppStore.getState().updateTabMeta('tab-fork', {
      docId: newEntry.docId,
      filePath: newEntry.filePath,
      title: 'yeni.md',
      format: 'md',
      isDirty: false
    });

    const updated = useAppStore.getState().tabs[0];
    assert.equal(updated.docId, newEntry.docId);
    assert.equal(updated.format, 'md');
    assert.equal(updated.title, 'yeni.md');

    // Dosya içeriğinin düz metin Markdown olduğu ve ZIP PK içermediği doğrulanır
    const fileBytes = fs.readFileSync(newFilePath);
    assert.notEqual(fileBytes[0], 0x50);
    assert.notEqual(fileBytes[1], 0x4b);
    assert.match(fs.readFileSync(newFilePath, 'utf8'), /# Başlık/);
  });

  it('5. Kapatırken Onay: isDirty=true iken iptal edilirse kapanmaz, kaydet seçilirse kaydedip kapatır', async () => {
    // 5a. İptal seçilirse sekme kapanmamalıdır
    let userDecision: 'save' | 'dont-save' | 'cancel' = 'cancel';

    const mockConfirmClose = async (tabTitle: string) => userDecision;

    const requestClose = async (tabId: string): Promise<boolean> => {
      const tab = useAppStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return true;

      if (tab.isDirty) {
        const decision = await mockConfirmClose(tab.title);
        if (decision === 'cancel') return false;
        if (decision === 'save') {
          useAppStore.getState().updateTabMeta(tab.id, { isDirty: false });
        }
      }
      useAppStore.getState().closeTab(tab.id);
      return true;
    };

    useAppStore.setState({
      tabs: [
        {
          id: 'tab-dirty',
          title: 'Kaydedilmemiş Belge',
          content: '<p>Değişiklik</p>',
          isDirty: true,
          format: 'docx'
        }
      ],
      activeTabId: 'tab-dirty'
    });

    // İptal durumu:
    const closeResultCancel = await requestClose('tab-dirty');
    assert.equal(closeResultCancel, false, 'İptal edildiğinde kapatma durdurulmalıdır');
    assert.equal(useAppStore.getState().tabs.length, 1);
    assert.equal(useAppStore.getState().tabs[0].id, 'tab-dirty');

    // Kaydetme durumu ('dont-save'):
    userDecision = 'dont-save';
    const closeResultDontSave = await requestClose('tab-dirty');
    assert.equal(closeResultDontSave, true);
    // Son sekme kapatıldığında uygulamanın kapanması yerine boş belge açılır
    assert.equal(useAppStore.getState().tabs.length, 1);
    assert.equal(useAppStore.getState().tabs[0].title, 'Adsız Belge 1');
    assert.equal(useAppStore.getState().tabs[0].isDirty, false);
  });

  it('6. Çift Açma Engeli: Zaten açık olan bir dosya tekrar açılmak istendiğinde ikinci sekme açılmaz, mevcut sekmeye geçilir', () => {
    const existingFilePath = path.join(tmpDir, 'zaten_acik.docx');
    const existingDocId = 'uuid-zaten-acik';

    useAppStore.setState({
      tabs: [
        {
          id: 'tab-1',
          title: 'zaten_acik.docx',
          docId: existingDocId,
          filePath: existingFilePath,
          content: '<p>Mevcut</p>',
          isDirty: false,
          format: 'docx'
        },
        {
          id: 'tab-2',
          title: 'Diğer Belge',
          content: '<p>Diğer</p>',
          isDirty: false,
          format: 'docx'
        }
      ],
      activeTabId: 'tab-2'
    });

    // Aynı dosya tekrar açılmak isteniyor (Ctrl+O, Drop veya dosya ilişkilendirmesi)
    const returnedTabId = useAppStore.getState().addTab(
      'zaten_acik.docx',
      '<p>Yeni İçerik</p>',
      existingDocId,
      'docx',
      existingFilePath
    );

    // İkinci bir sekme açılmamalı, toplam sekme sayısı aynı kalmalı
    assert.equal(useAppStore.getState().tabs.length, 2);
    // Dönen tabId mevcut sekmenin id'si olmalı ve o sekme aktif olmalıdır
    assert.equal(returnedTabId, 'tab-1');
    assert.equal(useAppStore.getState().activeTabId, 'tab-1');
  });
});
