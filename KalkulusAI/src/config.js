import { parseArgs } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SYSTEM_PROMPT = 
  "You are a helpful assistant. Provide clean, highly readable responses with clear headings, bullet points, and clean line spacing. Always respond in the exact programming language requested by the user (such as Java, C++, Python, JavaScript, HTML, C, etc.). Do not default to Python unless requested. Output code blocks with clear language tags or filenames. Whenever the user requests a diagram, flowchart, architecture map, process flow, or visual structure, render it directly in the terminal using clean Unicode/ASCII box-drawing characters (such as ┌ ┐ └ ┘ │ ─ ├ ┤ ┬ ┴ ┼ ▲ ▼ ◄ ►) wrapped inside a text code block (```text).";

export const DEFAULT_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_MODEL = "KalkulusAI";

export class Config {
  constructor({
    baseUrl = process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
    apiKey = process.env.OPENAI_API_KEY || '',
    model = process.env.LLM_MODEL || DEFAULT_MODEL,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    temperature = 0.7,
    maxTokens = null,
    maxHistoryMessages = 50,
    mock = false,
    debug = false,
  } = {}) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.temperature = temperature;
    this.maxTokens = maxTokens;
    this.maxHistoryMessages = maxHistoryMessages;
    this.mock = mock;
    this.debug = debug;
  }

  static async fromArgs(args = process.argv.slice(2)) {
    const options = {
      'base-url': { type: 'string' },
      'api-key': { type: 'string' },
      'model': { type: 'string', short: 'm' },
      'system': { type: 'string', short: 's' },
      'system-file': { type: 'string' },
      'temperature': { type: 'string', short: 't' },
      'max-tokens': { type: 'string' },
      'max-history': { type: 'string' },
      'mock': { type: 'boolean' },
      'debug': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    };

    let parsed;
    try {
      parsed = parseArgs({ args, options, allowPositionals: false });
    } catch (err) {
      console.error(`Invalid arguments: ${err.message}`);
      process.exit(1);
    }

    if (parsed.values.help) {
      Config.printHelp();
      process.exit(0);
    }

    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    if (parsed.values.system) {
      systemPrompt = parsed.values.system;
    } else if (parsed.values['system-file']) {
      try {
        const filePath = path.resolve(parsed.values['system-file']);
        const content = await fs.readFile(filePath, 'utf-8');
        systemPrompt = content.trim();
      } catch (err) {
        throw new Error(`Failed to read system prompt file: ${err.message}`);
      }
    }

    return new Config({
      baseUrl: parsed.values['base-url'] || process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || DEFAULT_BASE_URL,
      apiKey: parsed.values['api-key'] || process.env.OPENAI_API_KEY || '',
      model: parsed.values.model || process.env.LLM_MODEL || DEFAULT_MODEL,
      systemPrompt,
      temperature: parsed.values.temperature ? parseFloat(parsed.values.temperature) : 0.7,
      maxTokens: parsed.values['max-tokens'] ? parseInt(parsed.values['max-tokens'], 10) : null,
      maxHistoryMessages: parsed.values['max-history'] ? parseInt(parsed.values['max-history'], 10) : 50,
      mock: Boolean(parsed.values.mock),
      debug: Boolean(parsed.values.debug),
    });
  }

  static printHelp() {
    console.log(`
CLI Chatbot

Options:
  --base-url URL         API Base URL
  -m, --model MODEL      Model name
  -s, --system PROMPT    System prompt string
  --system-file FILE     Path to system prompt file
  -t, --temperature NUM  Sampling temperature
  -h, --help             Show help
`);
  }
}
