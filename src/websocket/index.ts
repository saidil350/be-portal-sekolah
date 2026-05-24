import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '@/logging';

let io: SocketIOServer | null = null;

export const initializeWebSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('room.join', (payload: { tenantId: string; userId: string; role: string }) => {
      socket.join(`tenant_${payload.tenantId}`);
      socket.join(`user_${payload.userId}`);
      logger.info(`Socket ${socket.id} joined tenant_${payload.tenantId} and user_${payload.userId}`);
    });

    socket.on('room.leave', (payload: { tenantId: string; userId: string }) => {
      socket.leave(`tenant_${payload.tenantId}`);
      socket.leave(`user_${payload.userId}`);
      logger.info(`Socket ${socket.id} left tenant_${payload.tenantId} and user_${payload.userId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToTenant(tenantId: string, event: string, data: unknown) {
  if (io) {
    io.to(`tenant_${tenantId}`).emit(event, data);
  }
}

export function emitToUser(userId: string, event: string, data: unknown) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}
