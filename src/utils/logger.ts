const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgCyan: "\x1b[46m",
  bgMagenta: "\x1b[45m",
  bold: "\x1b[1m",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19);
}

function formatTag(tag: string): string {
  return `${colors.cyan}[${tag}]${colors.reset}`;
}

export const log = {
  info(tag: string, message: string) {
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${formatTag(tag)} ${colors.white}${message}${colors.reset}`
    );
  },

  success(tag: string, message: string) {
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${formatTag(tag)} ${colors.green}${colors.bold}${message}${colors.reset}`
    );
  },

  warn(tag: string, message: string) {
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${formatTag(tag)} ${colors.yellow}${message}${colors.reset}`
    );
  },

  error(tag: string, message: string) {
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${formatTag(tag)} ${colors.red}${colors.bold}${message}${colors.reset}`
    );
  },

  request(method: string, path: string, body: any) {
    const bodyStr = JSON.stringify(body);
    const truncated = bodyStr.length > 200 ? bodyStr.substring(0, 200) + "..." : bodyStr;
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${colors.magenta}[HTTP]${colors.reset} ${colors.bold}${method}${colors.reset} ${path} ${colors.dim}${truncated}${colors.reset}`
    );
  },

  order(action: string, symbol: string, details: string) {
    console.log(
      `${colors.dim}${timestamp()}${colors.reset} ${colors.bgGreen}${colors.bold} ORDER ${colors.reset} ${colors.bold}${action}${colors.reset} ${symbol} ${colors.dim}${details}${colors.reset}`
    );
  },
};
