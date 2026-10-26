#!/usr/bin/env node

import process from 'node:process';
import { Config } from '../src/config.js';
import { ChatSession } from '../src/core.js';

async function main() {
  try {
    const config = await Config.fromArgs();

    if (!process.argv.includes('--model') && !process.argv.includes('-m')) {
      config.model = 'KalkulusAI';
    }

    const session = new ChatSession(config);
    await session.run();
  } catch (err) {
    console.error(`Initialization error: ${err.message}`);
    process.exit(1);
  }
}

main();
