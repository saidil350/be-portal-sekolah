import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Menghapus transport pino-pretty karena menyebabkan isu
  // "worker thread exited" (MODULE_NOT_FOUND worker.js) pada Next.js 15 dev mode
});
