import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface EmailIngestionProgress {
  stage: 'CONNECTING' | 'FETCHING' | 'STORING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  emailAccountId: string;
  totalEmails?: number;
  processedEmails?: number;
  currentEmail?: {
    subject: string;
    from: string;
  };
  error?: string;
  completedSteps: {
    fetched: boolean;
    stored: boolean;
    processed: boolean;
  };
  progress: number;
  estimatedTimeRemaining?: number;
}

@WebSocketGateway({
  namespace: 'email-ingestion',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  },
})
export class EmailGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EmailGateway.name);
  private userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove socket from user mapping
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(client: Socket, userId: string) {
    this.logger.log(`Registering client ${client.id} for user ${userId}`);
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(client.id);
  }

  sendProgressUpdate(userId: string, progress: EmailIngestionProgress) {
    const userSocketIds = this.userSockets.get(userId);
    if (!userSocketIds) return;

    for (const socketId of userSocketIds) {
      this.server.to(socketId).emit('progress', progress);
    }
  }
} 