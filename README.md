# Kalkulus Code

A 100% portable, zero-dependency CLI AI environment built in pure JavaScript (Node.js ES Modules) by **Avadhoot Savle**.

Designed for complete offline portability on USB drives with local LLMs, program generation into a `Data/` folder, auto-resolving image attachments in an `images/` folder, and interactive slash commands.

---

## Key Features

- **100% Pure JavaScript (Node.js)**: Zero external `npm` dependencies. Runs natively on Node.js 18+.
- **100% Free & Portable (USB Pendrive Ready)**: Stores ~23 GB of local GGUF models directly inside `./KalkulusAI/models/`.
- **Program & Code Execution Engine**:
  - Automatically saves C++, Java, Python, HTML, CSS, JavaScript, and SQL programs directly into the **`Data/`** folder when requested (`save`).
- **Vision & Image Understanding**:
  - Auto-resolves images placed inside the **`images/`** folder when using `/image demo.png`.
- **One-Click Launchers**:
  - `run.sh` / `run.bat`: Launches the chatbot, setting model directory to `./KalkulusAI/models/`.
  - `install_ollama.sh` / `install_ollama.bat`: One-click first-time installer.

---

## Installed Offline Models (`./KalkulusAI/models/`)

| Model | Size | Purpose |
| :--- | :--- | :--- |
| **`deepseek-r1:8b`** | 5.2 GB | **Logical Thinking & Step-by-Step Reasoning** |
| **`qwen2.5-coder:7b`** | 4.7 GB | **Coding, C++, Java, Python, SQL & Debugging** |
| **`qwen2.5vl:7b`** | 6.0 GB | **Code Screenshots, OCR, UI Layouts & Vision** |
| **`llama3.1:8b`** | 4.9 GB | Advanced General Knowledge & Reasoning |
| **`qwen2.5:3b`** | 1.9 GB | Fast Balanced Text Generation |
| **`qwen2.5:1.5b`** | 986 MB | Ultra-Lightweight Fast Model |

---

## Interactive Slash Commands

| Command | Description | Example |
| :--- | :--- | :--- |
| `/load <file>` | Load any local code file into AI context | `/load Data/main.cpp` |
| `/diff <file>` | Inspect code file contents in `Data/` | `/diff main.cpp` |
| `/image <file>` | Attach an image from `images/` folder | `/image demo.png` |
| `/maxtokens [limit]` | View or override max response token output | `/maxtokens 2048` |
| `/save [file]` | Export chat transcript to `history/` | `/save` |
| `/tokens` | Show estimated history token count | `/tokens` |
| `/changemodel` | Open interactive model menu | `/changemodel` |
| `/clear` | Clear chat history | `/clear` |
| `/system [prompt]` | View or update system prompt | `/system You are a C++ expert.` |
| `/history` | Print full conversation transcript | `/history` |
| `/help` | Show in-app help menu | `/help` |
| `/exit` | Exit the CLI session | `/exit` |

---

## Quick Start

### 1. Launch Chatbot
- **Mac / Linux**: Run `./run.sh`
- **Windows**: Double-click `run.bat`

### 2. First-Time Setup (If Ollama is not installed)
- **Mac / Linux**: Run `./install_ollama.sh`
- **Windows**: Double-click `install_ollama.bat`

---

## Project Structure

```text
.
├── Data/                    # Generated programs (.cpp, .java, .py, .html)
├── history/                 # Persistent chat history & exported logs (.json / .md)
├── images/                  # Image files for vision prompts
├── run.sh                   # Mac/Linux one-click launcher
├── run.bat                  # Windows one-click launcher
├── install_ollama.sh        # Mac/Linux first-time installer
├── install_ollama.bat       # Windows first-time installer
├── README.md                # Documentation
├── LICENSE                  # Official MIT License (Copyright Avadhoot Savle)
└── KalkulusAI/              # Core engine, models, & source code
    ├── package.json         # ES Module manifest
    ├── models/              # Portable directory holding ~23 GB of local LLMs
    ├── installers/          # Standalone node.exe & OllamaSetup.exe
    ├── bin/
    │   └── cli.js           # Main executable entrypoint
    ├── tests/               # Comprehensive automated test suite
    └── src/
        ├── config.js        # Settings & CLI args parser
        ├── core.js          # REPL chat controller
        ├── history.js       # Message history memory & export
        ├── launcher.js      # Interactive model selector
        ├── tools.js         # Program saving & tool execution runner
        ├── cli/
        │   ├── formatting.js # Terminal ANSI formatting
        │   └── router.js    # Slash command router
        └── providers/
            ├── base.js      # SSE stream parser
            └── openai-compat.js
```

---

## License

Copyright © 2026 **Avadhoot Savle**. All rights reserved.

Licensed under the [MIT License](LICENSE). Any redistribution or use of this software must retain the copyright notice attributable to Avadhoot Savle.
