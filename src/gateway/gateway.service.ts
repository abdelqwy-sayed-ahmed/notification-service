import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { NotificationGateway } from './gateway.gateway';
import { MessageSentPayload } from '../common/events/message.events';

@Injectable()
export class GatewayService implements OnModuleInit {

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly redis: RedisService,
    private readonly gateway: NotificationGateway,
  ) {}

  // Register the message handler once everything is wired up
  onModuleInit() {
    this.rabbitMQ.registerHandler(this.handleMessageSent.bind(this));
  }

  // handle message.sent 

  private async handleMessageSent(payload: MessageSentPayload) {
    console.debug(
      `Processing message.sent — room ${payload.roomId} tenant ${payload.tenantId}`,
    );

    // 1. Emit to the room channel — every client that joined this room
    //    receives the new message instantly regardless of online status
    this.gateway.emitToRoom(payload.tenantId, payload.roomId, 'new_message', {
      messageId: payload.messageId,
      roomId: payload.roomId,
      senderId: payload.senderId,
      content: payload.content,
      createdAt: payload.createdAt,
    });

    // 2. For recipients NOT currently in the room view (e.g. on a different
    //    screen), send a targeted notification to their socket directly
    const onlineRecipients = await this.redis.getOnlineRecipients(
      payload.tenantId,
      payload.recipientIds,
    );

    for (const { userId, socketId } of onlineRecipients) {
      this.gateway.emitToSocket(socketId, 'notification', {
        type: 'new_message',
        messageId: payload.messageId,
        roomId: payload.roomId,
        preview: payload.content.slice(0, 60),  // short preview for notification badge
        createdAt: payload.createdAt,
      });

      console.debug(`Notified user ${userId} via socket ${socketId}`);
    }

    const offlineCount = payload.recipientIds.length - onlineRecipients.length;
    if (offlineCount > 0) {
      //  will handle offline recipients later
      console.debug(`${offlineCount} recipient(s) offline — will handle in Step 9`);
    }
  }
}