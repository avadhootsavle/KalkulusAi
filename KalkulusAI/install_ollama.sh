#!/bin/bash
echo "Installing Ollama..."

if command -v brew >/dev/null 2>&1; then
  echo "Using Homebrew..."
  brew install ollama
else
  echo "Using official installation script..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo "Ollama installation complete!"
