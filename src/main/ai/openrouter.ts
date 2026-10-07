import { getApiKey } from '../keystore';
import { OpenRouterModel } from '../../shared/types';

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
export const DEFAULT_TEXT_MODEL = 'deepseek/deepseek-v4.1-flash';
export const DEFAULT_IMAGE_MODEL = 'bytedance-seed/seedream-5-0-lite';

const activeControllers = new Map<string, AbortController>();

export function abortAiRequest(requestId: string): boolean {
  const controller = activeControllers.get(requestId);
  if (controller) {
    controller.abort();
    activeControllers.delete(requestId);
    return true;
  }
  return false;
}

function getHeaders(): Record<string, string> {
  const key = getApiKey();
  if (!key) {
    throw new Error('OpenRouter API anahtarı ayarlanmamış.');
  }
  return {
    'Authorization': `Bearer ${key}`,
    'HTTP-Referer': 'https://kalem.local',
    'X-Title': 'Kalem',
    'Content-Type': 'application/json'
  };
}

export async function fetchAvailableModels(): Promise<{ textModels: OpenRouterModel[]; imageModels: OpenRouterModel[] }> {
  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/models`);
    if (!response.ok) {
      throw new Error(`Modeller alınamadı: ${response.status}`);
    }
    const json = (await response.json()) as any;
    const allModels: any[] = json.data || [];

    const textModels: OpenRouterModel[] = [];
    const imageModels: OpenRouterModel[] = [];

    for (const m of allModels) {
      const outputModalities: string[] = m.architecture?.output_modalities || ['text'];
      const modelObj: OpenRouterModel = {
        id: m.id,
        name: m.name || m.id,
        description: m.description,
        outputModalities,
        contextLength: m.context_length
      };

      if (outputModalities.includes('image')) {
        imageModels.push(modelObj);
      } else {
        textModels.push(modelObj);
      }
    }

    // Ensure defaults are present in lists if not returned
    if (!textModels.some(m => m.id === DEFAULT_TEXT_MODEL)) {
      textModels.unshift({
        id: DEFAULT_TEXT_MODEL,
        name: 'DeepSeek V4.1 Flash (Varsayılan)',
        outputModalities: ['text']
      });
    }
    if (!imageModels.some(m => m.id === DEFAULT_IMAGE_MODEL)) {
      imageModels.unshift({
        id: DEFAULT_IMAGE_MODEL,
        name: 'ByteDance Seedream 5.0 Lite (Varsayılan)',
        outputModalities: ['image']
      });
    }

    return { textModels, imageModels };
  } catch (err: any) {
    return {
      textModels: [{ id: DEFAULT_TEXT_MODEL, name: 'DeepSeek V4.1 Flash', outputModalities: ['text'] }],
      imageModels: [{ id: DEFAULT_IMAGE_MODEL, name: 'Seedream 5.0 Lite', outputModalities: ['image'] }]
    };
  }
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (totalTokens?: number) => void;
  onError: (error: string) => void;
}

export async function streamChat(
  requestId: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  callbacks: StreamCallbacks,
  retryCount: number = 0
): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(requestId, controller);

  try {
    const headers = getHeaders();
    const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: model || DEFAULT_TEXT_MODEL,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API anahtarınız geçersiz. Lütfen Ayarlar bölümünden anahtarınızı kontrol edin.');
      }
      if (response.status === 402) {
        throw new Error('Kredi yetersiz. OpenRouter hesabınızdaki bakiyeyi kontrol edin.');
      }
      if (response.status === 429) {
        if (retryCount === 0) {
          activeControllers.delete(requestId);
          // Wait 2 seconds and retry once
          await new Promise(res => setTimeout(res, 2000));
          return streamChat(requestId, model, messages, callbacks, 1);
        }
        throw new Error('İstek sınırı aşıldı (429). Lütfen biraz bekleyip tekrar deneyin.');
      }
      throw new Error(`Yapay zeka servisi yanıt vermedi (${response.status}).`);
    }

    if (!response.body) {
      throw new Error('Akış yanıtı boş döndü.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let totalTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        if (trimmed === 'data: [DONE]') continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');
        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            callbacks.onChunk(content);
          }
          if (parsed.usage?.total_tokens) {
            totalTokens = parsed.usage.total_tokens;
          }
        } catch {
          // Incomplete chunk
        }
      }
    }

    callbacks.onDone(totalTokens || undefined);
  } catch (err: any) {
    if (controller.signal.aborted) {
      callbacks.onError('İşlem kullanıcı tarafından durduruldu.');
    } else {
      callbacks.onError(err.message || 'Bilinmeyen bir hata oluştu.');
    }
  } finally {
    activeControllers.delete(requestId);
  }
}

export async function nonStreamChat(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; totalTokens?: number }> {
  const headers = getHeaders();
  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || DEFAULT_TEXT_MODEL,
      messages,
      stream: false
    })
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('API anahtarı geçersiz (401).');
    if (response.status === 402) throw new Error('Kredi yetersiz (402).');
    if (response.status === 429) throw new Error('İstek sınırı aşıldı (429).');
    throw new Error(`API hatası: ${response.status}`);
  }

  const json = (await response.json()) as any;
  const content = json.choices?.[0]?.message?.content || '';
  const totalTokens = json.usage?.total_tokens;

  return { content, totalTokens };
}

export async function generateAiImage(
  model: string,
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<{ imageDataUrl: string; totalTokens?: number }> {
  const headers = getHeaders();
  const selectedModel = model || DEFAULT_IMAGE_MODEL;

  // Formulate prompt with aspect ratio instruction
  const finalPrompt = `${prompt} (Aspect Ratio: ${aspectRatio}, high aesthetic quality, clean composition)`;

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'user', content: finalPrompt }
      ],
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: aspectRatio
      }
    })
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('API anahtarı geçersiz (401).');
    if (response.status === 402) throw new Error('Kredi yetersiz (402).');
    if (response.status === 429) throw new Error('İstek sınırı aşıldı (429).');
    throw new Error(`Görsel üretilemedi: ${response.status}`);
  }

  const json = (await response.json()) as any;
  const message = json.choices?.[0]?.message;

  // 1. Look for images array
  if (message?.images && message.images.length > 0) {
    const imgUrl = message.images[0]?.image_url?.url || message.images[0]?.url;
    if (imgUrl) return { imageDataUrl: imgUrl, totalTokens: json.usage?.total_tokens };
  }

  // 2. Look for base64 or url in content
  const content = message?.content;
  if (typeof content === 'string') {
    const match = content.match(/data:image\/[a-zA-Z]+;base64,[^"\s\)]+/);
    if (match) {
      return { imageDataUrl: match[0], totalTokens: json.usage?.total_tokens };
    }
    const httpMatch = content.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp)/i);
    if (httpMatch) {
      return { imageDataUrl: httpMatch[0], totalTokens: json.usage?.total_tokens };
    }
  }

  throw new Error('Modelden görsel formatında geçerli bir veri alınamadı.');
}
