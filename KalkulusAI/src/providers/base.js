
export function parseSseChunk(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) {
    return null;
  }

  if (trimmed.startsWith('data: ')) {
    const dataStr = trimmed.slice(6).trim();
    if (dataStr === '[DONE]') {
      return null;
    }

    try {
      const payload = JSON.parse(dataStr);
      const choices = payload.choices;
      if (!Array.isArray(choices) || choices.length === 0) {
        return null;
      }
      const delta = choices[0]?.delta;
      if (!delta) return null;
      if (delta.content) return delta.content;
      if (delta.reasoning_content) return delta.reasoning_content;
      return null;
    } catch {
      return null;
    }
  }

  return null;
}
