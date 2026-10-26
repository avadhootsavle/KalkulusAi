import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { colorize, printError, printSuccess, TermColor } from './cli/formatting.js';

export class ToolRunner {

  async processResponse(assistantText, userPrompt = '') {
    const promptLower = userPrompt.toLowerCase();
    const saveKeywords = ['save', 'create', 'write', 'make', 'generate', 'store', 'export', 'file', 'program', 'folder', 'directory', 'website'];
    const userRequestedSave = saveKeywords.some(kw => promptLower.includes(kw));


    const folderMatch = userPrompt.match(/(?:folder|directory|project|subfolder)\s+([a-zA-Z0-9_\-]+)/i);
    const targetSubfolder = folderMatch ? folderMatch[1] : '';

    const codeBlockRegex = /```([^\n]*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(assistantText)) !== null) {
      const header = (match[1] || '').trim();
      const content = match[2];

      if (!content || !content.trim()) continue;

      const cleanHeader = header.toLowerCase();


      if (['bash', 'sh', 'cmd', 'powershell'].includes(cleanHeader)) {
        const command = content.trim();
        if (command && this.isSafeCommand(command)) {
          console.log(colorize(`\n  ▸ Executing tool command: ${command}`, TermColor.DIM));
          await this.runShellCommand(command);
          continue;
        }
      }

      const hasExplicitFileTag = /^(?:file:|filename:|[a-zA-Z0-9_\-\+]+:)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)$/i.test(header);

      if (!userRequestedSave && !hasExplicitFileTag) {
        continue;
      }

      const targetFilename = this.determineFilename(header, content, assistantText, userPrompt);
      if (targetFilename) {
        let savePath = targetFilename;


        if (targetSubfolder && !savePath.includes('/') && !savePath.includes('\\')) {
          savePath = path.join('Data', targetSubfolder, savePath);
        } else if (!path.isAbsolute(savePath) && !savePath.startsWith('Data' + path.sep) && !savePath.startsWith('Data/')) {
          savePath = path.join('Data', savePath);
        }

        try {
          const resolvedPath = path.resolve(savePath);
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, content.trim() + '\n', 'utf-8');
          printSuccess(`Saved program: ${savePath}`);
        } catch (err) {
          printError(`Failed to save ${savePath}: ${err.message}`);
        }
      }
    }
  }

  determineFilename(header, content, assistantText, userPrompt) {
    const combinedContext = `${userPrompt}\n${assistantText}`.toLowerCase();


    const explicitMatch = header.match(/^(?:file:|filename:|[a-zA-Z0-9_\-\+]+:)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)$/i);
    if (explicitMatch) {
      return explicitMatch[1];
    }


    const filenameMentionMatch = combinedContext.match(/(?:save|create|write|file|name[d]?)\s+(?:as\s+|in\s+|to\s+)?([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/i);
    if (filenameMentionMatch) {
      return filenameMentionMatch[1];
    }

    const cleanHeader = header.toLowerCase();

    // 3. Language extension fallback matching
    if (['html', 'htm'].includes(cleanHeader)) {
      return 'index.html';
    }
    if (cleanHeader === 'css') {
      return 'style.css';
    }
    if (['javascript', 'js'].includes(cleanHeader)) {
      return 'script.js';
    }
    if (['java'].includes(cleanHeader)) {
      const classMatch = content.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/);
      return classMatch ? `${classMatch[1]}.java` : 'Main.java';
    }
    if (['cpp', 'c++', 'cxx', 'cc'].includes(cleanHeader)) {
      return 'main.cpp';
    }
    if (cleanHeader === 'c') {
      return 'main.c';
    }
    if (['python', 'py'].includes(cleanHeader)) {
      return 'main.py';
    }
    if (['typescript', 'ts'].includes(cleanHeader)) {
      return 'main.ts';
    }
    if (['txt', 'text', 'plain'].includes(cleanHeader)) {
      return 'output.txt';
    }
    if (cleanHeader === 'sql') {
      return 'query.sql';
    }

    // 4. Content heuristics
    if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
      return 'index.html';
    }
    if (content.includes('body {') || content.includes('margin:') || content.includes('padding:')) {
      return 'style.css';
    }
    if (content.includes('public class ') || content.includes('System.out.println')) {
      const classMatch = content.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/);
      return classMatch ? `${classMatch[1]}.java` : 'Main.java';
    }
    if (content.includes('#include <iostream>') || content.includes('std::cout')) {
      return 'main.cpp';
    }
    if (content.includes('def main(') || content.includes('if __name__ == "__main__":')) {
      return 'main.py';
    }

    return 'program.txt';
  }

  isSafeCommand(cmd) {
    const lower = cmd.toLowerCase();
    if (lower.includes('rm -rf /') || lower.includes('format c:')) {
      return false;
    }
    return true;
  }

  runShellCommand(command) {
    return new Promise((resolve) => {
      exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
        if (stdout && stdout.trim()) {
          console.log(colorize(stdout.trim(), TermColor.GRAY));
        }
        if (stderr && stderr.trim()) {
          console.log(colorize(stderr.trim(), TermColor.YELLOW));
        }
        if (error) {
          printError(`Command exited with error code ${error.code}`);
        }
        resolve();
      });
    });
  }
}
