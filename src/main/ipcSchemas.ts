import { z } from 'zod';

// Maximum sizes
export const MAX_CONTENT_STRING_LENGTH = 50 * 1024 * 1024; // 50MB
export const MAX_CONTENT_BUFFER_BYTES = 100 * 1024 * 1024; // 100MB
export const MAX_ASSET_DATAURL_LENGTH = 25 * 1024 * 1024; // 25MB
export const MAX_PDF_HTML_LENGTH = 20 * 1024 * 1024; // 20MB

// Document Formats
export const DocumentFormatSchema = z.enum([
  'docx',
  'md',
  'txt',
  'html',
  'odt',
  'rtf',
  'doc',
  'pdf'
]);

export const SaveDialogFormatSchema = z.enum([
  'docx',
  'md',
  'txt',
  'html',
  'odt',
  'rtf',
  'doc'
]);

// Windows-safe filename regex (no < > : " / \ | ? *)
export const SafeFileNameRegex = /^[^<>:"/\\|?*\x00-\x1F]+$/;

// 1. Filesystem schemas
export const ShowSaveDialogSchema = z.object({
  defaultTitle: z
    .string()
    .trim()
    .min(1, 'Varsayılan başlık boş olamaz.')
    .max(255, 'Başlık 255 karakterden uzun olamaz.')
    .refine((val) => SafeFileNameRegex.test(val), {
      message: 'Dosya adı geçersiz karakterler (< > : " / \\ | ? *) içeremez.'
    }),
  format: SaveDialogFormatSchema
});

const isBinaryBuffer = (val: unknown): val is Uint8Array | Buffer => {
  if (!val || typeof val !== 'object') return false;
  return (
    val instanceof Uint8Array ||
    Buffer.isBuffer(val) ||
    ArrayBuffer.isView(val) ||
    (val as any).constructor?.name === 'Uint8Array' ||
    (val as any).constructor?.name === 'Buffer'
  );
};

export const SaveFileSchema = z.object({
  docId: z.string().uuid('Geçersiz belge kimliği formatı (UUID bekleniyor).'),
  content: z.union([
    z.string().max(MAX_CONTENT_STRING_LENGTH, 'Metin içeriği 50MB sınırını aşıyor.'),
    z.custom<Uint8Array | Buffer>(isBinaryBuffer, {
      message: 'İkili dosya içeriği (Buffer veya Uint8Array) bekleniyor.'
    }).refine((buf) => (buf as Uint8Array | Buffer).byteLength <= MAX_CONTENT_BUFFER_BYTES, {
      message: 'İkili dosya içeriği 100MB sınırını aşıyor.'
    })
  ])
});

export const ExportPdfSchema = z.object({
  htmlContent: z
    .string()
    .min(1, 'HTML içeriği boş olamaz.')
    .max(MAX_PDF_HTML_LENGTH, 'HTML içeriği 20MB sınırını aşıyor.'),
  defaultTitle: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((val) => SafeFileNameRegex.test(val), {
      message: 'Dosya adı geçersiz karakterler içeremez.'
    })
    .optional()
});

export const SaveAssetSchema = z.object({
  dataUrl: z
    .string()
    .max(MAX_ASSET_DATAURL_LENGTH, 'Görsel veri boyutu 25MB sınırını aşıyor.')
    .regex(
      /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Geçersiz görsel Data URL formatı (PNG, JPEG, WebP base64 desteklenir).'
    )
});

export const OpenDroppedFilePathSchema = z.object({
  filePath: z
    .string()
    .trim()
    .min(1, 'Dosya yolu boş olamaz.')
    .max(1024, 'Dosya yolu çok uzun.')
});

export const RequestIdSchema = z
  .string()
  .trim()
  .min(1, 'İstek kimliği boş olamaz.')
  .max(128, 'İstek kimliği 128 karakterden uzun olamaz.');


// 2. AI schemas with length bounds

export const GenerateArticleSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(1, 'Konu boş olamaz.')
    .max(1000, 'Konu 1000 karakterden uzun olamaz.'),
  wordCount: z.enum(['200-400', '400-600', '600-800', '800+', 'custom']),
  customWordCount: z.string().max(50).optional(),
  tone: z.string().trim().min(1).max(100),
  language: z.string().trim().min(1).max(50),
  instructions: z.string().max(3000, 'Talimatlar 3000 karakterden uzun olamaz.').optional()
});

export const RewriteSchema = z.object({
  text: z
    .string()
    .min(1, 'Metin boş olamaz.')
    .max(50000, 'Metin 50.000 karakterden uzun olamaz.'),
  action: z.enum(['longer', 'shorter', 'fix', 'tone', 'rephrase', 'translate']),
  tone: z.string().max(100).optional(),
  language: z.string().max(50).optional()
});

export const ProofreadBlockSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().max(50000),
  index: z.number().int().min(0)
});

export const ProofreadBlocksSchema = z
  .array(ProofreadBlockSchema)
  .max(500, 'Tek seferde en fazla 500 blok denetlenebilir.');

export const TranslateSchema = z.object({
  text: z
    .string()
    .min(1, 'Çevrilecek metin boş olamaz.')
    .max(50000, 'Metin 50.000 karakterden uzun olamaz.'),
  targetLanguage: z.string().trim().min(1).max(50)
});

export const ImagePromptSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Görsel istemi metni boş olamaz.')
    .max(10000, 'Metin 10.000 karakterden uzun olamaz.')
});

export const ImageGenSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'İstem boş olamaz.')
    .max(2000, 'İstem 2000 karakterden uzun olamaz.'),
  style: z.enum(['photorealistic', 'illustration', 'minimalist', '3d', 'watercolor']),
  aspectRatio: z.enum(['16:9', '1:1', '4:3']),
  selectedText: z.string().max(5000).optional()
});

// Helper validation runner
export function validateIpc<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`).join(', ');
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
