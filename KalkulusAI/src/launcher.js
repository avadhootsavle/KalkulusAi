import readline from 'node:readline/promises';
import process from 'node:process';

export function getModelDescription(modelName) {
  const name = modelName.toLowerCase();

  if (name === 'kalkulusai' || name === 'auto') {
    return 'made by Avadhoot ';
  }
  if (name.includes('qwen2.5vl') || name.includes('qwen2.5-vl')) {
    return 'Best for Reading Code Screenshots, OCR & Image Documents';
  }
  if (name.includes('qwen2.5-coder') || name.includes('coder')) {
    return 'Best for Coding, C++, Java, Python, SQL & Debugging';
  }
  if (name.includes('deepseek-r1') || name.includes('deepseek')) {
    return 'Best for Logical Thinking & Step-by-Step Reasoning';
  }
  if (name.includes('llama3.1') || name.includes('llama3')) {
    return 'Best for General Knowledge, Reasoning & Essay Writing';
  }
  if (name.includes('qwen2.5:3b') || name.includes('3b')) {
    return 'Best for Fast Balanced Text & Chat';
  }
  if (name.includes('1.5b')) {
    return 'Best for Ultra-Fast Lightweight Response';
  }

  return 'General Local AI Model';
}

export function autoSelectBestModel(userPrompt = '', hasImages = false, availableModels = []) {
  const defaultFallback = availableModels[0] || 'qwen2.5-coder:7b';
  if (availableModels.length === 0) return defaultFallback;

  const findModel = (keyword) => availableModels.find(m => m.toLowerCase().includes(keyword));

  // 1. Image attached -> Vision model
  if (hasImages) {
    return findModel('vl') || findModel('vision') || findModel('llava') || defaultFallback;
  }

  const text = userPrompt.toLowerCase();

  // 2. Coding keywords -> qwen2.5-coder:7b
  const codeKeywords = ['code', 'c++', 'cpp', 'java', 'python', 'javascript', 'html', 'css', 'sql', 'function', 'class', 'bug', 'fix', 'debug', 'refactor', 'script', 'compile', 'index.html', 'main.cpp', 'program'];
  if (codeKeywords.some(kw => text.includes(kw))) {
    return findModel('coder') || findModel('qwen2.5-coder') || defaultFallback;
  }

  // 3. Logic & Math keywords -> deepseek-r1
  const logicKeywords = ['solve', 'logic', 'math', 'proof', 'prove', 'reason', 'riddle', 'step by step', 'calculate', 'algorithm', 'puzzle'];
  if (logicKeywords.some(kw => text.includes(kw))) {
    return findModel('deepseek') || findModel('r1') || defaultFallback;
  }

  // 4. General questions -> llama3.1:8b or default
  return findModel('llama3.1') || findModel('llama') || defaultFallback;
}

export async function fetchInstalledModels(baseUrl = 'http://localhost:11434/v1') {
  let cleanUrl = baseUrl.replace(/\/+$/, '');

  const tryEndpoints = [
    cleanUrl.endsWith('/models') ? cleanUrl : (cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`),
    'http://127.0.0.1:11434/v1/models',
    'http://localhost:11434/api/tags',
    'http://127.0.0.1:11434/api/tags',
  ];

  for (const url of tryEndpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          return data.data.map(m => m.id);
        }
        if (Array.isArray(data.models)) {
          return data.models.map(m => m.name || m.model);
        }
      }
    } catch {
      // Try next endpoint fallback
    }
  }

  return [];
}

export async function selectModelInteractive(config) {
  const models = await fetchInstalledModels(config.baseUrl);

  if (models.length === 0) {
    return config.model;
  }

  const modelOptions = ['KalkulusAI', ...models];

  console.log('\nSelect an AI Model:\n');

  modelOptions.forEach((m, idx) => {
    const isDef = (idx === 0) ? ' (default)' : (m === config.model ? ' (selected)' : '');
    const desc = getModelDescription(m);
    const paddedName = m.padEnd(16, ' ');
    console.log(`  ${idx}. ${paddedName} → ${desc}${isDef}`);
  });

  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question('Select model [0]: ');
    const selection = answer.trim();

    if (!selection || selection === '0' || selection.toLowerCase() === 'kalkulusai' || selection.toLowerCase() === 'auto') {
      rl.close();
      console.log('');
      return 'KalkulusAI';
    }

    const num = parseInt(selection, 10);
    if (!isNaN(num) && num >= 1 && num < modelOptions.length) {
      rl.close();
      console.log('');
      return modelOptions[num];
    }

    const match = models.find(m => m.toLowerCase().includes(selection.toLowerCase()));
    rl.close();
    console.log('');

    if (match) {
      return match;
    }

    return 'KalkulusAI';
  } catch {
    rl.close();
    return 'KalkulusAI';
  }
}
