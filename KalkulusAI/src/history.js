import fs from 'node:fs/promises';
import path from 'node:path';

export class MessageHistory {
  constructor({ systemPrompt = null, maxMessages = 50 } = {}) {
    this.maxMessages = maxMessages;
    this._systemPrompt = systemPrompt;
    this.messages = [];

    if (systemPrompt) {
      this.setSystemPrompt(systemPrompt);
    }
  }

  get systemPrompt() {
    return this._systemPrompt;
  }

  setSystemPrompt(prompt) {
    this._systemPrompt = prompt;
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0] = { role: 'system', content: prompt };
    } else {
      this.messages.unshift({ role: 'system', content: prompt });
    }
  }

  addUserMessage(content, imagePaths = []) {
    const msg = { role: 'user', content };
    if (imagePaths && imagePaths.length > 0) {
      msg.images = imagePaths;
    }
    this.messages.push(msg);
    this._trimIfNeeded();
  }

  addAssistantMessage(content) {
    this.messages.push({ role: 'assistant', content });
    this._trimIfNeeded();
  }

  clear({ keepSystemPrompt = true } = {}) {
    if (keepSystemPrompt && this._systemPrompt) {
      this.messages = [{ role: 'system', content: this._systemPrompt }];
    } else {
      this.messages = [];
    }
  }

  getMessages() {
    return this.messages.map(m => {
      const out = { role: m.role, content: m.content };
      if (m.images && m.images.length > 0) {
        out.images = m.images;
      }
      return out;
    });
  }

  _trimIfNeeded() {
    const hasSystem = this.messages.length > 0 && this.messages[0].role === 'system';
    const startIndex = hasSystem ? 1 : 0;
    const nonSystemCount = this.messages.length - startIndex;

    if (nonSystemCount > this.maxMessages) {
      const excess = nonSystemCount - this.maxMessages;
      this.messages.splice(startIndex, excess);
    }
  }

  estimateTokens() {
    const totalChars = this.messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.max(1, Math.floor(totalChars / 4));
  }

  async loadPersistentHistory(filePath = path.join('history', 'chat_history.json')) {
    try {
      const resolvedPath = path.resolve(filePath);
      const dataStr = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(dataStr);
      if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        this.messages = parsed.messages;
        if (parsed.systemPrompt) {
          this._systemPrompt = parsed.systemPrompt;
        }
      }
    } catch {

    }
  }

  async savePersistentHistory(filePath = path.join('history', 'chat_history.json')) {
    try {
      const resolvedPath = path.resolve(filePath);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await this.exportJson(resolvedPath);
    } catch {

    }
  }

  async exportJson(filePath) {
    const resolvedPath = path.resolve(filePath);
    const data = {
      systemPrompt: this._systemPrompt,
      messages: this.getMessages(),
      estimatedTokens: this.estimateTokens(),
    };
    await fs.writeFile(resolvedPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async exportMarkdown(filePath) {
    const resolvedPath = path.resolve(filePath);
    const lines = ['# Chatbot Conversation Export\n'];

    if (this._systemPrompt) {
      lines.push(`> **System Prompt**: ${this._systemPrompt}\n\n---\n`);
    }

    for (const msg of this.messages) {
      if (msg.role === 'system') continue;
      const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
      lines.push(`### ${roleLabel}\n\n${msg.content}\n`);
    }

    await fs.writeFile(resolvedPath, lines.join('\n'), 'utf-8');
  }

  get length() {
    return this.messages.length;
  }
}
