import process from 'node:process';

export const TermColor = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',

  // Foreground
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m',

  BRIGHT_CYAN: '\x1b[96m',
  BRIGHT_GREEN: '\x1b[92m',
  BRIGHT_YELLOW: '\x1b[93m',
  BRIGHT_WHITE: '\x1b[97m',
};

export function supportsColor() {
  if (process.env.NO_COLOR || process.env.TERM === 'dumb') {
    return false;
  }
  return process.stdout.isTTY;
}

export function colorize(text, colorCode) {
  if (!supportsColor()) {
    return text;
  }
  return `${colorCode}${text}${TermColor.RESET}`;
}

export function printBanner(model, baseUrl) {
  const asciiArt = `
  ▄▄▄▄   ▄▄▄      ▄▄              ▄▄                                       
 █▀ ██  ██         ██              ██                              █▄      
    ██ ██          ██ ▄▄           ██                              ██      
    █████    ▄▀▀█▄ ██ ██ ▄█▀ ██ ██ ██ ██ ██ ▄██▀█   ▄███▀ ▄███▄ ▄████ ▄█▀█▄
    ██ ██▄   ▄█▀██ ██ ████   ██ ██ ██ ██ ██ ▀███▄   ██    ██ ██ ██ ██ ██▄█▀
  ▀██▀  ▀██▄▄▀█▄██▄██▄██ ▀█▄▄▀██▀█▄██▄▀██▀██▄▄██▀  ▄▀███▄▄▀███▀▄█▀███▄▀█▄▄▄
`;
  console.log(colorize(asciiArt, TermColor.RED + TermColor.BOLD));
}

export function printSystemMsg(msg) {
  console.log(colorize(`  ▸ ${msg}`, TermColor.DIM));
}

export function printError(msg) {
  console.error(colorize(`  ✖ error: ${msg}`, TermColor.RED));
}

export function printSuccess(msg) {
  console.log(colorize(`  ✔ ${msg}`, TermColor.GREEN));
}

export function formatStreamToken(token, state = { inCode: false }) {
  if (token.includes('```')) {
    state.inCode = !state.inCode;
    if (supportsColor()) {
      return colorize(token, TermColor.BRIGHT_YELLOW + TermColor.BOLD);
    }
    return token;
  }

  if (!supportsColor()) {
    return token;
  }

  if (state.inCode) {
    return colorize(token, TermColor.CYAN);
  }

  return colorize(token, TermColor.BRIGHT_WHITE);
}
