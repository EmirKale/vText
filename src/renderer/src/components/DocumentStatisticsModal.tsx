import React, { useMemo, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, BarChart3, BookOpen, Clock, FileText, AlignLeft, Mic } from 'lucide-react';

interface DocumentStatisticsModalProps {
  content: string;
}

export const DocumentStatisticsModal: React.FC<DocumentStatisticsModalProps> = ({ content }) => {
  const { isStatsOpen, setStatsOpen } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStatsOpen) {
        setStatsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStatsOpen, setStatsOpen]);

  const stats = useMemo(() => {
    // Strip HTML tags and normalize spaces
    const plainText = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const wordsArray = plainText.length > 0 ? plainText.split(' ').filter(Boolean) : [];
    const words = wordsArray.length;
    const charsWithSpaces = plainText.length;
    const charsWithoutSpaces = plainText.replace(/\s/g, '').length;

    // Count paragraphs using block tags or double newlines
    const paragraphMatches = content.match(/<(p|h[1-6]|li|blockquote)[^>]*>/gi);
    const paragraphs = paragraphMatches ? paragraphMatches.length : (words > 0 ? 1 : 0);

    // Count sentences
    const sentencesMatches = plainText.match(/[^.!?]+[.!?]+(\s|$)/g);
    const sentences = sentencesMatches ? sentencesMatches.length : (words > 0 ? 1 : 0);

    // Estimated lines (~65 characters per line standard A4)
    const estimatedLines = words > 0 ? Math.max(1, Math.ceil(charsWithSpaces / 65)) : 0;

    // Estimated A4 pages (~280 words per page standard formatting)
    const estimatedPages = words > 0 ? Math.max(1, Math.ceil(words / 280)) : 1;

    // Reading time (200 words per minute)
    const readingMinutes = Math.floor(words / 200);
    const readingSeconds = Math.round(((words % 200) / 200) * 60);

    // Speaking time (130 words per minute)
    const speakingMinutes = Math.floor(words / 130);
    const speakingSeconds = Math.round(((words % 130) / 130) * 60);

    // Average word length
    const avgWordLength = words > 0 ? (charsWithoutSpaces / words).toFixed(1) : '0';

    return {
      words,
      charsWithSpaces,
      charsWithoutSpaces,
      paragraphs,
      sentences,
      estimatedLines,
      estimatedPages,
      readingMinutes,
      readingSeconds,
      speakingMinutes,
      speakingSeconds,
      avgWordLength
    };
  }, [content]);

  if (!isStatsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => setStatsOpen(false)}
    >
      <div
        className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-float overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-chrome/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Belge İstatistikleri</h2>
              <p className="text-2xs text-muted">Sözcük ve karakter sayımı ayrıntıları</p>
            </div>
          </div>
          <button
            onClick={() => setStatsOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-ink/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlight Cards */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-paper border border-line/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xs text-muted font-medium">Sözcük Sayısı</div>
                <div className="text-lg font-bold text-ink tabular-nums">
                  {stats.words.toLocaleString('tr-TR')}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-paper border border-line/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-2xs text-muted font-medium">Tahmini Sayfa</div>
                <div className="text-lg font-bold text-ink tabular-nums">
                  {stats.estimatedPages}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Metric Rows */}
          <div className="rounded-xl border border-line bg-paper divide-y divide-line/60 text-xs tabular-nums">
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-muted/70" />
                Karakterler (boşluksuz)
              </span>
              <span className="font-semibold text-ink">{stats.charsWithoutSpaces.toLocaleString('tr-TR')}</span>
            </div>

            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5 text-muted/70" />
                Karakterler (boşluklarla)
              </span>
              <span className="font-semibold text-ink">{stats.charsWithSpaces.toLocaleString('tr-TR')}</span>
            </div>

            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted">Paragraflar</span>
              <span className="font-semibold text-ink">{stats.paragraphs.toLocaleString('tr-TR')}</span>
            </div>

            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted">Cümleler</span>
              <span className="font-semibold text-ink">{stats.sentences.toLocaleString('tr-TR')}</span>
            </div>

            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted">Tahmini Satırlar</span>
              <span className="font-semibold text-ink">{stats.estimatedLines.toLocaleString('tr-TR')}</span>
            </div>

            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-muted">Ortalama Sözcük Uzunluğu</span>
              <span className="font-semibold text-ink">{stats.avgWordLength} harf</span>
            </div>
          </div>

          {/* Reading & Speaking Times */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-chrome/60 border border-line flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-accent shrink-0" />
              <div>
                <div className="text-2xs text-muted">Okuma Süresi</div>
                <div className="text-xs font-semibold text-ink">
                  {stats.readingMinutes > 0 ? `${stats.readingMinutes} dk ` : ''}
                  {stats.readingSeconds} sn
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-chrome/60 border border-line flex items-center gap-2.5">
              <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="text-2xs text-muted">Sesli Okuma</div>
                <div className="text-xs font-semibold text-ink">
                  {stats.speakingMinutes > 0 ? `${stats.speakingMinutes} dk ` : ''}
                  {stats.speakingSeconds} sn
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-chrome/50 flex justify-end">
          <button
            onClick={() => setStatsOpen(false)}
            className="h-8 px-4 rounded-lg bg-ink text-paper text-xs font-medium hover:bg-ink/90 transition-colors shadow-sm"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
