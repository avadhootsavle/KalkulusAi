#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export OLLAMA_MODELS="$DIR/KalkulusAI/models"

# Check if port 11434 is already active before starting ollama serve
if ! nc -z 127.0.0.1 11434 >/dev/null 2>&1; then
  if command -v ollama >/dev/null 2>&1; then
    ollama serve >/dev/null 2>&1 &
    sleep 2
  fi
fi

node KalkulusAI/bin/cli.js "$@"
