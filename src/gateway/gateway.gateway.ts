import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { createAdapter } from '@socket.io/redis-adapter';

@WebSocketGateway({
  cors: { origin: '*' }, 
  namespace: '/',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly redisService: RedisService) {}

  initAdapter() {
    const ioServer = (this.server as any).server;

    ioServer.adapter(
      createAdapter(
        this.redisService.getClient(),
        this.redisService.getSubscriberClient(),
      ),
    );
    console.log('Socket.io Redis adapter attached');
  }
  // connection

  async handleConnection(client: Socket) {
    // For now we read userId and tenantId from handshake query
    const userId = Number(client.handshake.query.userId);
    const tenantId = client.handshake.query.tenantId as string;

    if (userId === 0 || !tenantId) {
      console.error(` missing userId or tenantId — disconnecting`);
      client.disconnect();
      return;
    }

    // Store on socket for easy access in other handlers
    client.data.userId = userId;
    client.data.tenantId = tenantId;

    // Mark user as online in Redis
    await this.redisService.setUserOnline(tenantId, userId, client.id);

    console.log(
      ` socket connection :User ${userId} (tenant: ${tenantId}) connected [${client.id}]`,
    );
  }

  // disconnection

  async handleDisconnect(client: Socket) {
    const { userId, tenantId } = client.data;
    if (userId && tenantId) {
      await this.redisService.setUserOffline(tenantId, userId);
      console.log(`User ${userId} (tenant: ${tenantId}) disconnected`);
    }
  }

  // join room 

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    // Socket.io rooms mirror the DB rooms — client joins on app load
    // so they receive messages emitted to that room channel
    const roomChannel = `room:${client.data.tenantId}:${data.roomId}`;
    await client.join(roomChannel);
    console.debug(`User ${client.data.userId} joined channel ${roomChannel}`);
    return { success: true };
  }

  // leave room 

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    const roomChannel = `room:${client.data.tenantId}:${data.roomId}`;
    await client.leave(roomChannel);
    console.debug(`User ${client.data.userId} left channel ${roomChannel}`);
    return { success: true };
  }

  //  emit helpers (called by GatewayService) 

  emitToRoom(tenantId: string, roomId: number, event: string, data: unknown) {
    const roomChannel = `room:${tenantId}:${roomId}`;
    this.server.to(roomChannel).emit(event, data);
  }

  emitToSocket(socketId: string, event: string, data: unknown) {
    this.server.to(socketId).emit(event, data);
  }
}
