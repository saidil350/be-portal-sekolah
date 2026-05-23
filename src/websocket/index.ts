import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '@/logging';

export const initializeWebSocket = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Contoh event untuk join room tenant
    socket.on('joinTenant', (tenantId: string) => {
      socket.join(`tenant_${tenantId}`);
      logger.info(`Socket ${socket.id} joined tenant ${tenantId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
