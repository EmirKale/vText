import { z } from 'zod';
import { GenerateArticleOptions, RewriteOptions } from '../../shared/types';

export const ProofreadSchema = z.array(
  z.object({
    original: z.string().describe('Hatalı orijinal ifade'),
    corrected: z.string().describe('Düzeltilmiş ifade'),
    reason: z.string().describe('Düzeltme sebebi (kısa açıklama)')
  })
);

export type ProofreadResponse = z.infer<typeof ProofreadSchema>;

export function getArticleSystemPrompt(options: GenerateArticleOptions): string {
  const languageNames: Record<string, string> = {
    tr: 'Türkçe',
    en: 'İngilizce',
    de: 'Almanca',
    es: 'İspanyolca'
  };
  const targetLang = languageNames[options.language] || options.language;

  const toneDescriptions: Record<string, string> = {
    informative: 'Bilgilendirici ve net',
    friendly: 'Samimi, akıcı ve sıcak',
    formal: 'Resmi, profesyonel ve kurumsal',
    persuasive: 'İkna edici ve etkileyici'
  };
  const toneDesc = toneDescriptions[options.tone] || options.tone;

  const targetWordCount = options.wordCount === 'custom' 
    ? (options.customWordCount || '500') 
    : options.wordCount;

  return `Sen profesyonel bir yazar ve editörsün.
GÖREV: Verilen konuda tam ve kapsamlı bir makale yaz.
DİL: ${targetLang}
ÜSLUP: ${toneDesc}
HEDEF KELİME SAYISI: Yaklaşık ${targetWordCount} kelime. Bu hedefe kesinlikle ±%10 hassasiyetle sadık kal.
YAPI: 
- H1 başlığı (# Başlık)
- İlgi çekici giriş bölümü
- H2 ve H3 alt başlıkları (##, ###) ile mantıksal bölümler
- Vurucu bir sonuç bölümü

KURALLAR:
1. Yanıtında YALNIZCA makalenin Markdown içeriğini döndür.
2. Kesinlikle "İşte makaleniz:", "Tabii ki,", "Giriş:", "Umarım beğenirsiniz" gibi hiçbir ön ek, son ek veya açıklama ekleme.
3. Çıktı doğrudan bir belgeye aktarılacaktır.`;
}

export function getRewriteSystemPrompt(options: RewriteOptions): string {
  let instruction = '';

  switch (options.action) {
    case 'longer':
      instruction = 'Seçilen metni anlamını, bağlamını ve tonunu koruyarak daha ayrıntılı, detaylı ve zenginleştirilmiş şekilde yeniden yaz. Cümleleri genişlet.';
      break;
    case 'shorter':
      instruction = 'Seçilen metni ana fikrini ve mesajını eksiltmeden mümkün olduğunca öz, vurucu ve net şekilde kısalt.';
      break;
    case 'fix':
      instruction = 'Seçilen metindeki tüm yazım, imla, noktalama ve dil bilgisi hatalarını düzelt. Anlamı, kelime seçimini ve cümle akışını kesinlikle DEĞİŞTİRME.';
      break;
    case 'tone':
      const toneMap: Record<string, string> = {
        formal: 'resmi, profesyonel ve kurumsal',
        friendly: 'samimi, sıcak ve konuşma diline yakın',
        fluent: 'akıcı, dinamik ve etkileyici'
      };
      instruction = `Seçilen metni ${toneMap[options.tone || 'fluent'] || options.tone} bir üsluba dönüştür. Anlamı koru.`;
      break;
    case 'rephrase':
      instruction = 'Seçilen metni farklı kelimeler ve alternatif cümle yapıları kullanarak aynı anlamı koruyacak şekilde yeniden ifade et.';
      break;
    case 'translate':
      instruction = `Seçilen metni ${options.language || 'İngilizce'} diline doğal ve hatasız biçimde çevir. Biçimlendirmeleri koru.`;
      break;
  }

  return `Sen profesyonel bir metin editörüsün.
GÖREV: ${instruction}

KESİN KURALLAR:
1. Yanıtında YALNIZCA yeniden yazılan metni döndür.
2. ASLA "İşte yeni metin:", "Düzeltilmiş hali:", tırnak işaretleri, selamlama veya açıklama yazma.
3. Kaynak metnin dilini koru (çeviri görevi hariç).
4. Kalın, italik ve link gibi markdown biçimlendirmelerini mümkün olduğunca koru.`;
}

export function getProofreadSystemPrompt(): string {
  return `Sen titiz bir dil bilgisi ve imla denetçisisin.
GÖREV: Verilen metin bloğundaki yazım (imla), noktalama ve temel dil bilgisi hatalarını tespit et.

KESİN KURAL:
Anlamı, üslubu, yazarın kelime seçimini ve cümle yapısını KESİNLİKLE DEĞİŞTİRME. Yalnızca kural hatalarını (yanlış yazılmış kelimeler, eksik/fazla noktalama işaretleri, eklerin yazımı) düzelt.

ÇIKTI FORMATI:
Sadece ve sadece geçerli bir JSON dizisi (Array) döndür. Hiçbir markdown kod bloğu (örn. \`\`\`json) veya açıklama ekleme.
Örnek format:
[
  { "original": "herkez", "corrected": "herkes", "reason": "Yazım hatası" },
  { "original": "gelicem", "corrected": "geleceğim", "reason": "Gelecek zaman eki yazımı" }
]
Eğer metinde hiçbir hata yoksa boş bir JSON dizisi döndür: []`;
}

export function getTranslationSystemPrompt(targetLang: string): string {
  return `Sen profesyonel bir edebi ve teknik çevirmensin.
GÖREV: Verilen metni veya belge bölümünü ${targetLang} diline çevir.

KURALLAR:
1. Metnin biçimlendirmesini (başlık seviyeleri, kalın, italik, liste öğeleri, linkler) aynen koru.
2. Kod bloklarını ve teknik terimleri çevirmeden orijinal bırak.
3. YALNIZCA çevrilmiş içeriği döndür; açıklama veya karşılama metni ekleme.`;
}

export function getImagePromptGeneratorSystemPrompt(): string {
  return `You are an expert AI prompt engineer specializing in image generation.
TASK: Analyze the provided text passage and create a detailed, highly aesthetic, English image generation prompt that visually represents the core concept or emotion of the text.

RULES:
1. Output ONLY the English prompt description.
2. Do not include prefixes like "A photo of" or "Prompt:".
3. Keep it under 60 words, focusing on subject, lighting, composition, and mood.`;
}
