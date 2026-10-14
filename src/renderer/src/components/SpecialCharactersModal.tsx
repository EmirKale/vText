import React, { useState, useMemo, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { useAppStore } from '../store/useAppStore';
import { X, Search, Sparkles, Clock, Check } from 'lucide-react';

interface SpecialCharactersModalProps {
  editor: Editor | null;
}

interface SymbolItem {
  char: string;
  name: string;
  category: 'currency' | 'math' | 'typography' | 'arrows' | 'greek';
  code: string;
}

const SYMBOLS: SymbolItem[] = [
  // Para Birimleri
  { char: '₺', name: 'Türk Lirası Simgesi', category: 'currency', code: 'U+20BA' },
  { char: '€', name: 'Euro Simgesi', category: 'currency', code: 'U+20AC' },
  { char: '$', name: 'Dolar Simgesi', category: 'currency', code: 'U+0024' },
  { char: '£', name: 'İngiliz Sterlini Simgesi', category: 'currency', code: 'U+00A3' },
  { char: '¥', name: 'Japon Yeni / Çin Yuanı', category: 'currency', code: 'U+00A5' },
  { char: '₽', name: 'Rus Rublesi', category: 'currency', code: 'U+20BD' },
  { char: '₩', name: 'Kore Wonu', category: 'currency', code: 'U+20A9' },
  { char: '₿', name: 'Bitcoin Simgesi', category: 'currency', code: 'U+20BF' },
  { char: '¢', name: 'Sent Simgesi', category: 'currency', code: 'U+00A2' },
  { char: '₹', name: 'Hindistan Rupisi', category: 'currency', code: 'U+20B9' },
  { char: '¤', name: 'Genel Para Birimi', category: 'currency', code: 'U+00A4' },

  // Matematik ve Mantık
  { char: '±', name: 'Artı-Eksi Simgesi', category: 'math', code: 'U+00B1' },
  { char: '×', name: 'Çarpma Simgesi', category: 'math', code: 'U+00D7' },
  { char: '÷', name: 'Bölme Simgesi', category: 'math', code: 'U+00F7' },
  { char: '≠', name: 'Eşit Değildir', category: 'math', code: 'U+2260' },
  { char: '≈', name: 'Yaklaşık Eşit', category: 'math', code: 'U+2248' },
  { char: '≤', name: 'Küçük veya Eşit', category: 'math', code: 'U+2264' },
  { char: '≥', name: 'Büyük veya Eşit', category: 'math', code: 'U+2265' },
  { char: '∞', name: 'Sonsuzluk Simgesi', category: 'math', code: 'U+221E' },
  { char: '√', name: 'Karekök Simgesi', category: 'math', code: 'U+221A' },
  { char: '∑', name: 'Toplam (Sigma)', category: 'math', code: 'U+2211' },
  { char: '∏', name: 'Çarpım (Pi)', category: 'math', code: 'U+220F' },
  { char: '∫', name: 'İntegral Simgesi', category: 'math', code: 'U+222B' },
  { char: '∂', name: 'Kısmi Türev', category: 'math', code: 'U+2202' },
  { char: '∆', name: 'Delta / Değişim', category: 'math', code: 'U+2206' },
  { char: '‰', name: 'Binde Simgesi', category: 'math', code: 'U+2030' },
  { char: '¼', name: 'Dörtte Bir (Çeyrek)', category: 'math', code: 'U+00BC' },
  { char: '½', name: 'İkide Bir (Yarım)', category: 'math', code: 'U+00BD' },
  { char: '¾', name: 'Dörtte Üç', category: 'math', code: 'U+00BE' },
  { char: '⅓', name: 'Üçte Bir', category: 'math', code: 'U+2153' },
  { char: '⅔', name: 'Üçte İki', category: 'math', code: 'U+2154' },
  { char: '²', name: 'Kare (Üs 2)', category: 'math', code: 'U+00B2' },
  { char: '³', name: 'Küp (Üs 3)', category: 'math', code: 'U+00B3' },
  { char: '°', name: 'Derece Simgesi', category: 'math', code: 'U+00B0' },
  { char: 'µ', name: 'Mikro Simgesi', category: 'math', code: 'U+00B5' },
  { char: '∅', name: 'Boş Küme', category: 'math', code: 'U+2205' },
  { char: '∈', name: 'Elemanıdır', category: 'math', code: 'U+2208' },
  { char: '∉', name: 'Elemanı Değildir', category: 'math', code: 'U+2209' },
  { char: '∩', name: 'Kesişim', category: 'math', code: 'U+2229' },
  { char: '∪', name: 'Birleşim', category: 'math', code: 'U+222A' },

  // Yazım, Tipografi ve Noktalama
  { char: '©', name: 'Telif Hakkı (Copyright)', category: 'typography', code: 'U+00A9' },
  { char: '®', name: 'Tescilli Marka (Registered)', category: 'typography', code: 'U+00AE' },
  { char: '™', name: 'Ticari Marka (Trademark)', category: 'typography', code: 'U+2122' },
  { char: '§', name: 'Bölüm / Kısım Simgesi', category: 'typography', code: 'U+00A7' },
  { char: '¶', name: 'Paragraf Simgesi (Pilcrow)', category: 'typography', code: 'U+00B6' },
  { char: '•', name: 'Madde İmpuls Noktası (Bullet)', category: 'typography', code: 'U+2022' },
  { char: '—', name: 'Uzun Tire (Em Dash)', category: 'typography', code: 'U+2014' },
  { char: '–', name: 'Kısa Tire (En Dash)', category: 'typography', code: 'U+2013' },
  { char: '…', name: 'Üç Nokta (Ellipsis)', category: 'typography', code: 'U+2026' },
  { char: '«', name: 'Sol Fransız Tırnağı (Guillemet)', category: 'typography', code: 'U+00AB' },
  { char: '»', name: 'Sağ Fransız Tırnağı', category: 'typography', code: 'U+00BB' },
  { char: '“', name: 'Sol Çift Tırnak', category: 'typography', code: 'U+201C' },
  { char: '”', name: 'Sağ Çift Tırnak', category: 'typography', code: 'U+201D' },
  { char: '‘', name: 'Sol Tek Tırnak', category: 'typography', code: 'U+2018' },
  { char: '’', name: 'Sağ Tek Tırnak (Kesme)', category: 'typography', code: 'U+2019' },
  { char: '„', name: 'Alt Çift Tırnak', category: 'typography', code: 'U+201E' },
  { char: '†', name: 'Hançer (Dagger / Dipnot)', category: 'typography', code: 'U+2020' },
  { char: '‡', name: 'Çift Hançer (Double Dagger)', category: 'typography', code: 'U+2021' },
  { char: '№', name: 'Numara Simgesi', category: 'typography', code: 'U+2116' },

  // Oklar ve Şekiller
  { char: '←', name: 'Sol Ok', category: 'arrows', code: 'U+2190' },
  { char: '→', name: 'Sağ Ok', category: 'arrows', code: 'U+2192' },
  { char: '↑', name: 'Yukarı Ok', category: 'arrows', code: 'U+2191' },
  { char: '↓', name: 'Aşağı Ok', category: 'arrows', code: 'U+2193' },
  { char: '↔', name: 'Çift Yönlü Yatay Ok', category: 'arrows', code: 'U+2194' },
  { char: '↕', name: 'Çift Yönlü Dikey Ok', category: 'arrows', code: 'U+2195' },
  { char: '⇐', name: 'Çift Çizgili Sol Ok', category: 'arrows', code: 'U+21D0' },
  { char: '⇒', name: 'Çift Çizgili Sağ Ok', category: 'arrows', code: 'U+21D2' },
  { char: '⇔', name: 'Çift Çizgili İki Yönlü Ok', category: 'arrows', code: 'U+21D4' },
  { char: '✓', name: 'Onay İşareti (Checkmark)', category: 'arrows', code: 'U+2713' },
  { char: '✔', name: 'Kalın Onay İşareti', category: 'arrows', code: 'U+2714' },
  { char: '✕', name: 'Çarpı İşareti', category: 'arrows', code: 'U+2715' },
  { char: '★', name: 'Dolu Yıldız', category: 'arrows', code: 'U+2605' },
  { char: '☆', name: 'Boş Yıldız', category: 'arrows', code: 'U+2606' },
  { char: '⚡', name: 'Şimşek Simgesi', category: 'arrows', code: 'U+26A1' },
  { char: '☕', name: 'Kahve Fincanı', category: 'arrows', code: 'U+2615' },
  { char: '🔒', name: 'Kilit Simgesi', category: 'arrows', code: 'U+1F512' },
  { char: '💡', name: 'Fikir / Ampul Simgesi', category: 'arrows', code: 'U+1F4A1' },
  { char: '📌', name: 'Raptiye Simgesi', category: 'arrows', code: 'U+1F4CC' },

  // Yunan Harfleri
  { char: 'α', name: 'Alfa (Küçük)', category: 'greek', code: 'U+03B1' },
  { char: 'β', name: 'Beta (Küçük)', category: 'greek', code: 'U+03B2' },
  { char: 'γ', name: 'Gama (Küçük)', category: 'greek', code: 'U+03B3' },
  { char: 'δ', name: 'Delta (Küçük)', category: 'greek', code: 'U+03B4' },
  { char: 'ε', name: 'Epsilon (Küçük)', category: 'greek', code: 'U+03B5' },
  { char: 'θ', name: 'Teta (Küçük)', category: 'greek', code: 'U+03B8' },
  { char: 'λ', name: 'Lambda (Küçük)', category: 'greek', code: 'U+03BB' },
  { char: 'μ', name: 'Mü (Küçük)', category: 'greek', code: 'U+03BC' },
  { char: 'π', name: 'Pi (Küçük)', category: 'greek', code: 'U+03C0' },
  { char: 'ρ', name: 'Ro (Küçük)', category: 'greek', code: 'U+03C1' },
  { char: 'σ', name: 'Sigma (Küçük)', category: 'greek', code: 'U+03C3' },
  { char: 'τ', name: 'Tau (Küçük)', category: 'greek', code: 'U+03C4' },
  { char: 'φ', name: 'Fi (Küçük)', category: 'greek', code: 'U+03C6' },
  { char: 'ω', name: 'Omega (Küçük)', category: 'greek', code: 'U+03C9' },
  { char: 'Δ', name: 'Delta (Büyük)', category: 'greek', code: 'U+0394' },
  { char: 'Ω', name: 'Omega (Büyük / Ohm)', category: 'greek', code: 'U+03A9' },
  { char: 'Σ', name: 'Sigma (Büyük)', category: 'greek', code: 'U+03A3' },
  { char: 'Φ', name: 'Fi (Büyük)', category: 'greek', code: 'U+03A6' }
];

const CATEGORIES = [
  { id: 'all', label: 'Tümü' },
  { id: 'currency', label: 'Para' },
  { id: 'math', label: 'Matematik' },
  { id: 'typography', label: 'Tipografi' },
  { id: 'arrows', label: 'Oklar & Şekil' },
  { id: 'greek', label: 'Yunan' }
] as const;

export const SpecialCharactersModal: React.FC<SpecialCharactersModalProps> = ({ editor }) => {
  const { isSymbolsOpen, setSymbolsOpen } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hoveredSymbol, setHoveredSymbol] = useState<SymbolItem>(SYMBOLS[0]);
  const [justInserted, setJustInserted] = useState<string | null>(null);

  // Load / store recent characters from localStorage
  const [recentChars, setRecentChars] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('vtext_recent_symbols');
      return stored ? JSON.parse(stored) : ['₺', '€', '$', '±', '©', '®', '™', '→', '✓', '•', '°', '∞'];
    } catch {
      return ['₺', '€', '$', '±', '©', '®', '™', '→', '✓', '•', '°', '∞'];
    }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSymbolsOpen) {
        setSymbolsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSymbolsOpen, setSymbolsOpen]);

  const filteredSymbols = useMemo(() => {
    const s = search.toLowerCase().trim();
    return SYMBOLS.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!s) return true;
      return (
        item.char.toLowerCase().includes(s) ||
        item.name.toLowerCase().includes(s) ||
        item.code.toLowerCase().includes(s)
      );
    });
  }, [selectedCategory, search]);

  if (!isSymbolsOpen) return null;

  const handleInsert = (symbol: SymbolItem | string) => {
    const char = typeof symbol === 'string' ? symbol : symbol.char;
    if (editor) {
      editor.chain().focus().insertContent(char).run();
    }
    setJustInserted(char);
    setTimeout(() => setJustInserted(null), 1200);

    // Update recents
    setRecentChars((prev) => {
      const updated = [char, ...prev.filter((c) => c !== char)].slice(0, 12);
      try {
        localStorage.setItem('vtext_recent_symbols', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => setSymbolsOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-float overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-chrome/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-serif font-bold text-base">
              Ω
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Özel Karakterler ve Simgeler</h2>
              <p className="text-2xs text-muted">Belgenize eklemek istediğiniz simgeye tıklayın</p>
            </div>
          </div>
          <button
            onClick={() => setSymbolsOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-ink/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-line space-y-3 bg-surface">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Simge veya karakter ara (örn: lira, euro, telif, ok, kök)..."
              autoFocus
              className="w-full h-9 pl-9 pr-3 text-xs rounded-xl bg-paper border border-line focus:border-accent focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap transition-colors font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-ink text-paper shadow-sm'
                    : 'bg-paper text-muted hover:text-ink hover:bg-line/60 border border-line/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recently Used Section */}
        {recentChars.length > 0 && !search && selectedCategory === 'all' && (
          <div className="px-4 pt-3 pb-1 border-b border-line/60 bg-paper/30">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-muted uppercase tracking-wider mb-2">
              <Clock className="w-3 h-3" />
              <span>Son Kullanılanlar</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {recentChars.map((rc) => (
                <button
                  key={rc}
                  onClick={() => handleInsert(rc)}
                  onMouseEnter={() => {
                    const match = SYMBOLS.find((s) => s.char === rc);
                    if (match) setHoveredSymbol(match);
                  }}
                  className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-sm font-medium hover:border-accent hover:bg-accent/5 hover:scale-110 active:scale-95 transition-all text-ink"
                >
                  {rc}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid of Symbols */}
        <div className="p-4 overflow-y-auto flex-1 min-h-[220px]">
          {filteredSymbols.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-muted">
              <Sparkles className="w-6 h-6 mb-2 opacity-40" />
              <p className="text-xs font-medium">Eşleşen simge bulunamadı</p>
              <p className="text-2xs text-muted/80 mt-1">Farklı bir arama terimi deneyin</p>
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-2">
              {filteredSymbols.map((item) => (
                <button
                  key={item.char + item.code}
                  onClick={() => handleInsert(item)}
                  onMouseEnter={() => setHoveredSymbol(item)}
                  title={`${item.name} (${item.code})`}
                  className="h-10 rounded-xl border border-line/80 bg-paper hover:bg-accent/10 hover:border-accent flex items-center justify-center text-base font-medium text-ink transition-all hover:scale-110 active:scale-95 shadow-sm"
                >
                  {item.char}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Preview & Detail Footer */}
        <div className="px-5 py-3 border-t border-line bg-chrome/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-paper border border-line flex items-center justify-center text-xl font-serif font-bold text-accent shadow-sm">
              {hoveredSymbol?.char || '—'}
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">{hoveredSymbol?.name || 'Seçim yapılmadı'}</div>
              <div className="text-2xs text-muted font-mono">{hoveredSymbol?.code || ''}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {justInserted && (
              <span className="flex items-center gap-1 text-2xs text-success font-medium animate-fade-in bg-success/10 px-2 py-1 rounded-md">
                <Check className="w-3 h-3" />
                {justInserted} eklendi
              </span>
            )}
            <button
              onClick={() => handleInsert(hoveredSymbol)}
              className="h-8 px-3.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm"
            >
              Belgeye Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
