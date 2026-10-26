import readline from 'node:readline/promises';
import process from 'node:process';
import { MessageHistory } from './history.js';
import { OpenAICompatProvider } from './providers/openai-compat.js';
import { CommandRouter } from './cli/router.js';
import { ToolRunner } from './tools.js';
import { colorize, formatStreamToken, printBanner, printError, printSystemMsg, TermColor } from './cli/formatting.js';
import { autoSelectBestModel, fetchInstalledModels } from './launcher.js';

export class ChatSession {
  constructor(config) {
    this.config = config;
    this.history = new MessageHistory({
      systemPrompt: config.systemPrompt,
      maxMessages: config.maxHistoryMessages,
    });

    this.provider = new OpenAICompatProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });

    this.router = new CommandRouter(this);
    this.toolRunner = new ToolRunner();
    this.pendingImages = [];
    this.isGenerating = false;
    this.activeAbortController = null;
  }

  async run() {
    printBanner(this.config.model, this.config.baseUrl);

    await this.history.loadPersistentHistory();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.on('SIGINT', () => {
      if (this.isGenerating && this.activeAbortController) {
        this.activeAbortController.abort();
        console.log(colorize('\n[Generation interrupted by user]', TermColor.YELLOW));
      } else {
        console.log('\n');
        printSystemMsg('Exiting session.');
        rl.close();
        process.exit(0);
      }
    });

    try {
      while (true) {
        const userPromptStr = colorize('you> ', TermColor.BOLD + TermColor.RED);
        let line;
        try {
          line = await rl.question(`\n${userPromptStr}`);
        } catch {
          break;
        }

        if (line === undefined || line === null) {
          break;
        }

        let inputContent = line;

        if (inputContent.endsWith('\\')) {
          const lines = [inputContent.slice(0, -1)];
          while (true) {
            const contPrompt = colorize('...  ', TermColor.DIM);
            const contLine = await rl.question(contPrompt);
            if (contLine.endsWith('\\')) {
              lines.push(contLine.slice(0, -1));
            } else {
              lines.push(contLine);
              break;
            }
          }
          inputContent = lines.join('\n');
        }

        const trimmed = inputContent.trim();
        if (!trimmed) {
          continue;
        }

        if (this.router.isCommand(trimmed)) {
          await this.router.handleCommand(trimmed);
          continue;
        }

        await this._processUserTurn(trimmed);
      }
    } finally {
      rl.close();
    }
  }

  async _processUserTurn(content) {
    const imagesToAttach = [...this.pendingImages];
    this.pendingImages = [];
    this.history.addUserMessage(content, imagesToAttach);

    let targetModel = this.config.model;

    if (!targetModel || targetModel.toLowerCase() === 'auto' || targetModel.toLowerCase() === 'kalkulusai') {
      const installed = await fetchInstalledModels(this.config.baseUrl);
      targetModel = autoSelectBestModel(content, imagesToAttach.length > 0, installed);
      printSystemMsg(`Auto-Router selected: ${targetModel}`);
    }

    const assistantLabel = colorize('KalkulusAI> ', TermColor.BOLD + TermColor.BRIGHT_CYAN);
    process.stdout.write(`\n${assistantLabel}`);

    this.isGenerating = true;
    this.activeAbortController = new AbortController();
    const fullResponse = [];
    const streamState = { inCode: false };

    try {
      const stream = this.provider.streamChat({
        messages: this.history.getMessages(),
        model: targetModel,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        signal: this.activeAbortController.signal,
      });

      for await (const token of stream) {
        const formatted = formatStreamToken(token, streamState);
        process.stdout.write(formatted);
        fullResponse.push(token);
      }

      process.stdout.write('\n');
      const assistantReply = fullResponse.join('').trim();
      if (assistantReply) {
        this.history.addAssistantMessage(assistantReply);
        await this.history.savePersistentHistory();
        await this.toolRunner.processResponse(assistantReply, content);
      }
    } catch (err) {
      process.stdout.write('\n');
      if (this.activeAbortController.signal.aborted) {
        const partial = fullResponse.join('').trim();
        if (partial) {
          this.history.addAssistantMessage(partial);
          await this.history.savePersistentHistory();
        }
      } else {
        printError(`Failed to generate response: ${err.message}`);
        if (this.config.debug) {
          console.error(err);
        }
      }
    } finally {
      this.isGenerating = false;
      this.activeAbortController = null;
    }
  }
}
