import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { colorize, printError, printSuccess, printSystemMsg, TermColor } from './formatting.js';
import { selectModelInteractive } from '../launcher.js';

export class CommandRouter {
  constructor(session) {
    this.session = session;
  }

  isCommand(userInput) {
    return userInput.trim().startsWith('/');
  }

  async handleCommand(userInput) {
    const trimmed = userInput.trim();
    const spaceIdx = trimmed.indexOf(' ');
    const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

    switch (cmd) {
      case '/exit':
      case '/quit':
      case '/q':
        printSystemMsg('Goodbye!');
        process.exit(0);
        break;

      case '/help':
      case '/h':
        this._showHelp();
        break;

      case '/clear':
        this.session.history.clear({ keepSystemPrompt: true });
        await this.session.history.savePersistentHistory();
        printSuccess('Conversation history cleared (system prompt preserved).');
        break;

      case '/system':
        if (args) {
          this.session.history.setSystemPrompt(args);
          await this.session.history.savePersistentHistory();
          printSuccess(`System prompt updated: "${args}"`);
        } else {
          const current = this.session.history.systemPrompt || 'None';
          printSystemMsg(`Current System Prompt:\n${current}`);
        }
        break;

      case '/history':
        this._showHistory();
        break;

      case '/tokens': {
        const tokens = this.session.history.estimateTokens();
        const count = this.session.history.length;
        printSystemMsg(`History contains ${count} messages (~${tokens} estimated tokens).`);
        break;
      }

      case '/changemodel':
      case '/model':
      case '/models': {
        if (args) {
          this.session.config.model = args.trim();
          printSuccess(`Active model set to: ${this.session.config.model}`);
        } else {
          const newModel = await selectModelInteractive(this.session.config);
          this.session.config.model = newModel;
          printSuccess(`Active model changed to: ${this.session.config.model}`);
        }
        break;
      }

      case '/maxtokens': {
        if (args) {
          const limit = parseInt(args, 10);
          if (!isNaN(limit) && limit > 0) {
            this.session.config.maxTokens = limit;
            printSuccess(`Max output tokens updated to: ${limit}`);
          } else if (args.toLowerCase() === 'unlimited' || args.toLowerCase() === 'null') {
            this.session.config.maxTokens = null;
            printSuccess('Max output tokens reset to unlimited (model default).');
          } else {
            printError('Please specify a positive number or "unlimited" (e.g. /maxtokens 2048)');
          }
        } else {
          const current = this.session.config.maxTokens ?? 'unlimited';
          printSystemMsg(`Max response token limit: ${current}`);
        }
        break;
      }

      case '/image':
      case '/img':
        if (args) {
          let targetPath = args.trim();
          let resolvedPath = path.resolve(targetPath);

          try {
            await fs.access(resolvedPath);
          } catch {
            const imagesPath = path.resolve(path.join('images', targetPath));
            try {
              await fs.access(imagesPath);
              resolvedPath = imagesPath;
            } catch {
              if (!path.isAbsolute(targetPath) && !targetPath.startsWith('images' + path.sep)) {
                resolvedPath = path.resolve(path.join('images', targetPath));
              }
            }
          }

          this.session.pendingImages.push(resolvedPath);
          printSuccess(`Attached image: ${resolvedPath}`);
        } else {
          printError('Please provide an image filename (e.g. /image demo.png)');
        }
        break;

      case '/load':
      case '/read':
        if (args) {
          let targetPath = args.trim();
          let resolvedPath = path.resolve(targetPath);

          try {
            await fs.access(resolvedPath);
          } catch {
            const dataPath = path.resolve(path.join('Data', targetPath));
            try {
              await fs.access(dataPath);
              resolvedPath = dataPath;
            } catch {
              // file/dir not found
            }
          }

          try {
            const stat = await fs.stat(resolvedPath);
            if (stat.isDirectory()) {
              await this._loadDirectory(resolvedPath);
            } else {
              const content = await fs.readFile(resolvedPath, 'utf-8');
              const fileBasename = path.basename(resolvedPath);
              const loadedMessage = `[Loaded file: ${fileBasename}]\n\`\`\`\n${content}\n\`\`\``;
              this.session.history.addUserMessage(loadedMessage);
              await this.session.history.savePersistentHistory();
              printSuccess(`Loaded file into context: ${resolvedPath} (${content.length} characters)`);
            }
          } catch (err) {
            printError(`Failed to load '${targetPath}': ${err.message}`);
          }
        } else {
          printError('Please specify a file or folder path (e.g. /load Data or /load ./my-website)');
        }
        break;

      case '/diff':
        if (args) {
          let targetPath = args.trim();
          let resolvedPath = path.resolve(targetPath);

          try {
            await fs.access(resolvedPath);
          } catch {
            const dataPath = path.resolve(path.join('Data', targetPath));
            try {
              await fs.access(dataPath);
              resolvedPath = dataPath;
            } catch {
              // file not found
            }
          }

          try {
            const content = await fs.readFile(resolvedPath, 'utf-8');
            const fileBasename = path.basename(resolvedPath);
            printSystemMsg(`File ${fileBasename} content preview:\n\n${content}`);
          } catch (err) {
            printError(`Failed to read file for diff '${targetPath}': ${err.message}`);
          }
        } else {
          printError('Please specify a file path (e.g. /diff Data/main.cpp)');
        }
        break;

      case '/diagram':
      case '/chart':
        if (args) {
          const diagramPrompt = `Draw a complete, detailed visual ASCII/Unicode box diagram for: "${args}". Use box drawing characters (┌ ┐ └ ┘ │ ─ ├ ┤ ┬ ┴ ┼ ▲ ▼ ◄ ►) wrapped in a \`\`\`text code block so it displays cleanly in the terminal console.`;
          await this.session._processUserTurn(diagramPrompt);
        } else {
          printError('Please specify a topic for the diagram (e.g. /diagram web architecture or /diagram binary search tree)');
        }
        break;

      case '/save':
        await this._handleSave(args);
        break;

      default:
        printError(`Unknown command '${cmd}'. Type /help for available commands.`);
        break;
    }

    return true;
  }

  async _loadDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true });
    const allowedExts = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.cpp', '.java', '.py', '.c', '.h', '.md', '.txt', '.sql'];
    const loadedFiles = [];
    let totalChars = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExts.includes(ext)) {
        const fullPath = path.join(entry.path || dirPath, entry.name);
        const relPath = path.relative(dirPath, fullPath);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          loadedFiles.push(`--- File: ${relPath} ---\n\`\`\`${ext.slice(1)}\n${content}\n\`\`\``);
          totalChars += content.length;
        } catch {
          // ignore unreadable files
        }
      }
    }

    if (loadedFiles.length === 0) {
      printError(`No code or text files found inside directory '${dirPath}'`);
      return;
    }

    const folderBasename = path.basename(dirPath);
    const combinedMessage = `[Loaded directory: ${folderBasename} (${loadedFiles.length} files)]\n\n${loadedFiles.join('\n\n')}`;
    this.session.history.addUserMessage(combinedMessage);
    await this.session.history.savePersistentHistory();
    printSuccess(`Loaded folder '${folderBasename}': ${loadedFiles.length} files, ${totalChars} total characters into context!`);
  }

  _showHelp() {
    console.log(`
Commands:
  /diagram <topic>    Draw a terminal ASCII/Unicode box diagram for any topic
  /changemodel        Open interactive model menu (select 0 for Auto)
  /load <file|folder> Load a single file or an ENTIRE folder into AI context
  /diff <file>        Preview & inspect code file contents in Data/
  /image <path>       Attach an image file to next prompt turn
  /help               Show this help message
  /clear              Clear chat history
  /system <prompt>    View or update system prompt
  /history            Print message log
  /tokens             Show token estimate
  /maxtokens [limit]  View or override max output token limit
  /save [file]        Save chat log (.md or .json)
  /exit               Quit
`);
  }

  _showHistory() {
    const messages = this.session.history.getMessages();
    if (messages.length === 0) {
      printSystemMsg('History is empty.');
      return;
    }

    console.log(colorize('\n--- Message History ---', TermColor.DIM));
    for (const msg of messages) {
      const role = msg.role.toUpperCase();
      const color = role === 'USER' ? TermColor.CYAN : (role === 'ASSISTANT' ? TermColor.MAGENTA : TermColor.YELLOW);
      const snippet = msg.content.length > 120 ? `${msg.content.slice(0, 120)}...` : msg.content;
      console.log(`${colorize(role, color)}: ${snippet}`);
    }
    console.log(colorize('-----------------------\n', TermColor.DIM));
  }

  async _handleSave(args) {
    let filename = args.trim();
    if (!filename) {
      filename = path.join('history', 'chat_session.md');
    } else if (!path.isAbsolute(filename) && !filename.startsWith('history' + path.sep) && !filename.startsWith('Data' + path.sep)) {
      filename = path.join('history', filename);
    }
    const ext = path.extname(filename).toLowerCase();

    try {
      await fs.mkdir(path.dirname(path.resolve(filename)), { recursive: true });
      if (ext === '.json') {
        await this.session.history.exportJson(filename);
      } else {
        await this.session.history.exportMarkdown(filename);
      }
      printSuccess(`Session saved to ${path.resolve(filename)}`);
    } catch (err) {
      printError(`Failed to save file: ${err.message}`);
    }
  }
}
