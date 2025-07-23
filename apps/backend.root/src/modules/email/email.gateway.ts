import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
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
  namespace: 'email-ingestion-v2',
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
    this.logger.log(`🟢 EMAIL WS: Client connected: ${client.id} from ${client.handshake.address}`);
    // Note: Socket count logging removed due to API compatibility issues
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 EMAIL WS: Client disconnected: ${client.id}`);
    
    // Remove socket from user mapping
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        this.logger.log(`🔴 EMAIL WS: Removed client ${client.id} from user ${userId} mapping`);
        
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          this.logger.log(`🔴 EMAIL WS: Removed user ${userId} mapping (no more clients)`);
        }
        break;
      }
    }
    
    // Note: Socket count logging removed due to API compatibility issues
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`🏓 EMAIL WS: Received ping from ${client.id}:`, data);
    
    // Send pong back immediately
    client.emit('pong', {
      message: 'pong from email gateway',
      timestamp: new Date().toISOString(),
      clientId: client.id,
      receivedData: data,
    });
    
    this.logger.log(`🏓 EMAIL WS: Sent pong to ${client.id}`);
  }

  @SubscribeMessage('register')
  handleRegister(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    this.logger.log(`📝 EMAIL WS: Registering client ${client.id} for user ${userId}`);
    this.logger.debug(`📝 EMAIL WS: Registration data type: ${typeof userId}, value: "${userId}"`);
    
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
      this.logger.debug(`📝 EMAIL WS: Created new user mapping for ${userId}`);
    }
    
    this.userSockets.get(userId)?.add(client.id);
    
    const userSocketCount = this.userSockets.get(userId)?.size || 0;
    this.logger.log(`📝 EMAIL WS: User ${userId} now has ${userSocketCount} connected client(s)`);
    
    // Debug: Log all current user mappings
    const allMappings = Array.from(this.userSockets.entries()).map(([uid, sockets]) => 
      `${uid}:${sockets.size}`
    ).join(', ');
    this.logger.debug(`📝 EMAIL WS: All user mappings: [${allMappings}]`);
    
    // Send confirmation back to client
    client.emit('registered', { userId, message: 'Successfully registered for progress updates' });
    this.logger.log(`📝 EMAIL WS: Sent registration confirmation to ${client.id}`);
  }

  @SubscribeMessage('test-message')
  handleTestMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`💬 EMAIL WS: Received test message from ${client.id}:`, data);
    
    client.emit('test-response', {
      message: 'Test response from email gateway',
      timestamp: new Date().toISOString(),
      receivedData: data,
    });
    
    this.logger.log(`💬 EMAIL WS: Sent test response to ${client.id}`);
  }

  sendProgressUpdate(userId: string, progress: EmailIngestionProgress) {
    this.logger.debug(`📊 EMAIL WS: Looking for user ${userId} (type: ${typeof userId})`);
    
    const userSocketIds = this.userSockets.get(userId);
    
    if (!userSocketIds || userSocketIds.size === 0) {
      this.logger.warn(`⚠️ EMAIL WS: No connected clients found for user ${userId} - progress update will be lost`);
      
      // Debug: Log all current mappings to see what we have
      const allMappings = Array.from(this.userSockets.entries()).map(([uid, sockets]) => 
        `"${uid}":${sockets.size}`
      ).join(', ');
      this.logger.debug(`⚠️ EMAIL WS: Current user mappings: [${allMappings}]`);
      
      // Check if there's a similar userId (in case of type mismatch)
      const similarKeys = Array.from(this.userSockets.keys()).filter(key => 
        String(key).includes(String(userId).substring(0, 8)) || String(userId).includes(String(key).substring(0, 8))
      );
      if (similarKeys.length > 0) {
        this.logger.warn(`⚠️ EMAIL WS: Found similar user IDs: [${similarKeys.join(', ')}] - possible type mismatch?`);
      }
      
      return;
    }

    this.logger.debug(`📊 EMAIL WS: Sending progress update to user ${userId} (${userSocketIds.size} client(s)): ${progress.stage} - ${progress.progress}%`);
    
    let sentCount = 0;
    for (const socketId of userSocketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket && socket.connected) {
        socket.emit('progress', progress);
        sentCount++;
      } else {
        this.logger.warn(`⚠️ EMAIL WS: Socket ${socketId} for user ${userId} is not connected - removing from mapping`);
        userSocketIds.delete(socketId);
      }
    }
    
    if (sentCount === 0) {
      this.logger.warn(`⚠️ EMAIL WS: No active connections found for user ${userId} - all sockets were disconnected`);
      this.userSockets.delete(userId);
    } else {
      this.logger.debug(`📊 EMAIL WS: Progress update sent to ${sentCount} client(s) for user ${userId}`);
    }
  }
}
