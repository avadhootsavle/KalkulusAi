import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Config } from '../src/config.js';
import { MessageHistory } from '../src/history.js';
import { getModelDescription, autoSelectBestModel } from '../src/launcher.js';
import { ToolRunner } from '../src/tools.js';
import { CommandRouter } from '../src/cli/router.js';
import { parseSseChunk } from '../src/providers/base.js';
import { colorize, formatStreamToken, TermColor } from '../src/cli/formatting.js';

async function runComprehensiveTests() {
  console.log('\n========================================================');
  console.log('  RUNNING COMPREHENSIVE SUITE FOR KALKULUS AI');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Config Unit Tests
  test('Config: Default Values', () => {
    const cfg = new Config();
    assert.strictEqual(cfg.model, 'KalkulusAI');
    assert.strictEqual(cfg.baseUrl, 'http://localhost:11434/v1');
    assert.strictEqual(cfg.temperature, 0.7);
    assert.strictEqual(cfg.maxTokens, null);
  });

  await asyncTest('Config: CLI Arguments Parsing', async () => {
    const cfg = await Config.fromArgs(['--model', 'qwen2.5-coder:7b', '--temperature', '0.5', '--max-tokens', '1024']);
    assert.strictEqual(cfg.model, 'qwen2.5-coder:7b');
    assert.strictEqual(cfg.temperature, 0.5);
    assert.strictEqual(cfg.maxTokens, 1024);
  });

  // 2. Launcher & Auto-Router Unit Tests
  test('Launcher: getModelDescription for all tags', () => {
    assert.strictEqual(getModelDescription('KalkulusAI'), 'made by Avadhoot ');
    assert.strictEqual(getModelDescription('auto'), 'made by Avadhoot ');
    assert.strictEqual(getModelDescription('qwen2.5-coder:7b').includes('Coding'), true);
    assert.strictEqual(getModelDescription('deepseek-r1:8b').includes('Logical Thinking'), true);
    assert.strictEqual(getModelDescription('qwen2.5vl:7b').includes('Screenshots'), true);
    assert.strictEqual(getModelDescription('llama3.1:8b').includes('General Knowledge'), true);
    assert.strictEqual(getModelDescription('qwen2.5:3b').includes('Fast Balanced'), true);
    assert.strictEqual(getModelDescription('qwen2.5:1.5b').includes('Ultra-Fast'), true);
  });

  test('Launcher: autoSelectBestModel routing logic', () => {
    const models = ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'qwen2.5vl:7b', 'llama3.1:8b'];

    // Code queries -> qwen2.5-coder:7b
    assert.strictEqual(autoSelectBestModel('Write a C++ program for factorial', false, models), 'qwen2.5-coder:7b');
    assert.strictEqual(autoSelectBestModel('Fix Java class bug in Main.java', false, models), 'qwen2.5-coder:7b');
    assert.strictEqual(autoSelectBestModel('Build HTML CSS website page', false, models), 'qwen2.5-coder:7b');

    // Logic & Math queries -> deepseek-r1:8b
    assert.strictEqual(autoSelectBestModel('Solve this math logic puzzle step by step', false, models), 'deepseek-r1:8b');
    assert.strictEqual(autoSelectBestModel('Calculate algorithm complexity proof', false, models), 'deepseek-r1:8b');

    // Vision queries -> qwen2.5vl:7b
    assert.strictEqual(autoSelectBestModel('Describe this document', true, models), 'qwen2.5vl:7b');

    // General queries -> llama3.1:8b
    assert.strictEqual(autoSelectBestModel('What is the capital of France?', false, models), 'llama3.1:8b');
  });

  // 3. MessageHistory Unit Tests
  test('MessageHistory: Message insertion and trimming', () => {
    const history = new MessageHistory({ systemPrompt: 'System Prompt', maxMessages: 2 });
    history.addUserMessage('Msg 1');
    history.addAssistantMessage('Reply 1');
    history.addUserMessage('Msg 2');

    const msgs = history.getMessages();
    assert.strictEqual(msgs[0].role, 'system');
    assert.strictEqual(msgs.length, 3); // 1 system + 2 non-system max
    assert.strictEqual(msgs[1].content, 'Reply 1');
    assert.strictEqual(msgs[2].content, 'Msg 2');
  });

  await asyncTest('MessageHistory: Persistent Memory (history/chat_history.json)', async () => {
    const testHistoryPath = path.join('history', 'test_history.json');
    const h1 = new MessageHistory();
    h1.addUserMessage('User test message for persistent memory');
    h1.addAssistantMessage('Assistant response stored on disk');
    await h1.savePersistentHistory(testHistoryPath);

    const h2 = new MessageHistory();
    await h2.loadPersistentHistory(testHistoryPath);
    const msgs = h2.getMessages();

    assert.strictEqual(msgs.length, 2);
    assert.strictEqual(msgs[0].content, 'User test message for persistent memory');
    assert.strictEqual(msgs[1].content, 'Assistant response stored on disk');

    await fs.unlink(path.resolve(testHistoryPath));
  });

  await asyncTest('ToolRunner: Java Program Auto-Saving (Data/ClassName.java)', async () => {
    const runner = new ToolRunner();
    const assistantText = '```java\npublic class FactorialCalculator {\n  public static void main(String[] args) {}\n}\n```';
    await runner.processResponse(assistantText, 'write a java program and save it');

    const filePath = path.resolve(path.join('Data', 'FactorialCalculator.java'));
    const content = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(content.includes('FactorialCalculator'), true);
    await fs.unlink(filePath);
  });

  await asyncTest('ToolRunner: C++ Program Auto-Saving (Data/main.cpp)', async () => {
    const runner = new ToolRunner();
    const assistantText = '```cpp\n#include <iostream>\nint main() { std::cout << "Hello"; return 0; }\n```';
    await runner.processResponse(assistantText, 'save a cpp factorial program');

    const filePath = path.resolve(path.join('Data', 'main.cpp'));
    const content = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(content.includes('#include <iostream>'), true);
    await fs.unlink(filePath);
  });

  await asyncTest('ToolRunner: Python Program Auto-Saving (Data/main.py)', async () => {
    const runner = new ToolRunner();
    const assistantText = '```python\ndef calculate():\n    print("Python OK")\n```';
    await runner.processResponse(assistantText, 'write python script and save it');

    const filePath = path.resolve(path.join('Data', 'main.py'));
    const content = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(content.includes('Python OK'), true);
    await fs.unlink(filePath);
  });

  await asyncTest('ToolRunner: Text File Auto-Saving (Data/output.txt)', async () => {
    const runner = new ToolRunner();
    const assistantText = '```text\nSample text content output\n```';
    await runner.processResponse(assistantText, 'save a text file');

    const filePath = path.resolve(path.join('Data', 'output.txt'));
    const content = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(content.trim(), 'Sample text content output');
    await fs.unlink(filePath);
  });

  await asyncTest('ToolRunner: Custom Subfolder Website Saving (Data/my-app/index.html, style.css, script.js)', async () => {
    const runner = new ToolRunner();
    const assistantText = '```html\n<h1>App</h1>\n```\n```css\nh1 { color: red; }\n```\n```js\nconsole.log("App");\n```';
    await runner.processResponse(assistantText, 'create a folder my-app and save website code');

    const htmlPath = path.resolve(path.join('Data', 'my-app', 'index.html'));
    const cssPath = path.resolve(path.join('Data', 'my-app', 'style.css'));
    const jsPath = path.resolve(path.join('Data', 'my-app', 'script.js'));

    assert.strictEqual(await fs.readFile(htmlPath, 'utf-8'), '<h1>App</h1>\n');
    assert.strictEqual(await fs.readFile(cssPath, 'utf-8'), 'h1 { color: red; }\n');
    assert.strictEqual(await fs.readFile(jsPath, 'utf-8'), 'console.log("App");\n');

    await fs.rm(path.resolve(path.join('Data', 'my-app')), { recursive: true, force: true });
  });

  // 5. CommandRouter (/load, /diff, /maxtokens, /save) Unit Tests
  await asyncTest('CommandRouter: /load file and /load directory', async () => {
    const session = {
      config: { model: 'KalkulusAI', baseUrl: 'http://localhost:11434/v1', maxTokens: null },
      history: new MessageHistory(),
      pendingImages: [],
    };
    const router = new CommandRouter(session);

    // Test /load file
    await router.handleCommand('/load KalkulusAI/package.json');
    assert.strictEqual(session.history.getMessages().length, 1);
    assert.strictEqual(session.history.getMessages()[0].content.includes('kalkulus-ai'), true);

    // Test /load directory
    session.history.clear();
    await router.handleCommand('/load KalkulusAI/src');
    assert.strictEqual(session.history.getMessages().length, 1);
    assert.strictEqual(session.history.getMessages()[0].content.includes('config.js'), true);
  });

  await asyncTest('CommandRouter: /maxtokens limit override', async () => {
    const session = {
      config: { model: 'KalkulusAI', maxTokens: null },
      history: new MessageHistory(),
      pendingImages: [],
    };
    const router = new CommandRouter(session);

    await router.handleCommand('/maxtokens 4096');
    assert.strictEqual(session.config.maxTokens, 4096);

    await router.handleCommand('/maxtokens unlimited');
    assert.strictEqual(session.config.maxTokens, null);
  });

  // 6. SSE Stream Chunk Parser Tests
  test('SSE Parser: parseSseChunk handling', () => {
    const sseLine = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    assert.strictEqual(parseSseChunk(sseLine), 'Hello');
    assert.strictEqual(parseSseChunk('data: [DONE]'), null);
    assert.strictEqual(parseSseChunk(': ping comment'), null);
  });

  // 7. Formatting Tests
  test('Formatting: formatStreamToken colorization', () => {
    const state = { inCode: false };
    const codeTag = formatStreamToken('```cpp', state);
    if (process.stdout.isTTY) {
      assert.strictEqual(state.inCode, true);
      assert.strictEqual(codeTag.includes('\x1b['), true);
    } else {
      assert.strictEqual(state.inCode, true);
      assert.strictEqual(codeTag, '```cpp');
    }
  });

  console.log('\n========================================================');
  console.log(`  RESULTS: ${passed} / ${total} TESTS PASSED CLEANLY!`);
  console.log('========================================================\n');
}

runComprehensiveTests();
