import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSseChunk } from './base.js';

export class OpenAICompatProvider {
  constructor({ baseUrl, apiKey = 'ollama', timeoutMs = 120000 } = {}) {
    let cleanUrl = baseUrl.replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/chat/completions')) {
      if (cleanUrl.endsWith('/v1')) {
        cleanUrl = `${cleanUrl}/chat/completions`;
      } else {
        cleanUrl = `${cleanUrl}/v1/chat/completions`;
      }
    }
    this.endpointUrl = cleanUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async *streamChat({ messages, model, temperature = 0.7, maxTokens = null, signal = null }) {
    const modelLower = (model || '').toLowerCase();
    const isVisionModel = modelLower.includes('vl') || modelLower.includes('vision') || modelLower.includes('llava') || modelLower.includes('multimodal');

    const processedMessages = await Promise.all(
      messages.map(async (msg) => {
        const textContent = typeof msg.content === 'string'
          ? msg.content
          : (Array.isArray(msg.content) ? (msg.content[0]?.text || '') : String(msg.content || ''));

        // Strip images for non-vision models to prevent Ollama 400 Multimodal errors
        if (!isVisionModel || !msg.images || msg.images.length === 0) {
          return { role: msg.role, content: textContent };
        }

        const base64Images = [];
        const contentParts = [{ type: 'text', text: textContent }];

        for (const imgPath of msg.images) {
          try {
            const resolvedPath = path.resolve(imgPath);
            const buffer = await fs.readFile(resolvedPath);
            const base64 = buffer.toString('base64');
            base64Images.push(base64);

            const ext = path.extname(imgPath).toLowerCase().slice(1) || 'png';
            const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            });
          } catch {
            // image unavailable or unreadable, ignore silently
          }
        }

        const out = { role: msg.role, content: contentParts };
        if (base64Images.length > 0) {
          out.images = base64Images;
        }
        return out;
      })
    );

    const payload = {
      model,
      messages: processedMessages,
      stream: true,
      temperature,
    };
    if (maxTokens != null) {
      payload.max_tokens = maxTokens;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response;
    const urlsToTry = [
      this.endpointUrl.replace('localhost', '127.0.0.1'),
      this.endpointUrl,
    ];

    let lastError = null;
    for (const url of urlsToTry) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'custom-ai-cli-chatbot/1.0',
            ...(this.apiKey && this.apiKey !== 'none' ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (response.ok) {
          lastError = null;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!response || !response.ok) {
      clearTimeout(timer);
      if (lastError && lastError.name === 'AbortError') {
        throw new Error('Request timed out or cancelled by user.');
      }
      const errMsg = lastError ? lastError.message : (response ? await response.text() : 'No response from server');
      throw new Error(`Failed to connect to local Ollama server at ${this.endpointUrl}. Make sure Ollama is running.\nDetail: ${errMsg}`);
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        clearTimeout(timer);

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const content = parseSseChunk(line);
          if (content) {
            yield content;
          }
        }
      }

      if (buffer.length > 0) {
        const content = parseSseChunk(buffer);
        if (content) {
          yield content;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      throw new Error(`Stream error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
