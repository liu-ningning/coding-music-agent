const { config } = require('dotenv');
const { resolve, dirname } = require('path');
const { createServer } = require('./server/app');
const { createLogger } = require('./utils/logger');

const log = createLogger('sidecar');

// 加载根目录的 .env 文件
// 在 SEA 环境中，__dirname 可能不可用，使用 process.cwd() 作为备选
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
config({ path: resolve(currentDir, '../../../.env') });

// 支持命令行参数 --port 和环境变量 VITE_SIDECAR_PORT
function getPort(): number {
  // 1. 优先从命令行参数读取
  const portArg = process.argv.find((arg: string) => arg.startsWith('--port='));
  if (portArg) {
    const port = parseInt(portArg.split('=')[1], 10);
    if (!isNaN(port)) return port;
  }

  // 2. 命令行参数格式: --port 4567
  const portIndex = process.argv.indexOf('--port');
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const port = parseInt(process.argv[portIndex + 1], 10);
    if (!isNaN(port)) return port;
  }

  // 3. 从环境变量读取
  return Number(process.env.VITE_SIDECAR_PORT) || 4567;
}

const PORT = getPort();

async function main() {
  log.info('启动 Coding Music Agent sidecar...');

  // 创建 HTTP 服务
  const app = createServer();

  app.listen(PORT, () => {
    log.info(`HTTP 服务监听端口 ${PORT}`);
    log.info(`健康检查: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  log.error(`启动失败: ${err}`);
  process.exit(1);
});
