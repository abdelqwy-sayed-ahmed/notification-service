import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageSentPayload,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
} from 'src/common/events/message.events';
import * as amqplib from 'amqplib';

export type MessageHandler = (payload: MessageSentPayload) => Promise<void>;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private handler: MessageHandler | null = null;

  private readonly QUEUE_NAME = 'notification.queue';
  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  // Called by GatewayService after it's ready to handle messages
  registerHandler(handler: MessageHandler) {
    this.handler = handler;
  }

  private async connect() {
    try {
      const url = this.config.get<string>('RABBITMQ_URL');
      if (!url) throw new Error('RABBITMQ_URL is not defined');
      this.connection = await amqplib.connect(url);
      this.channel = await this.connection.createChannel();

      const channel = this.channel;
      if (!channel) {
        console.error(`error:channel not ready`);
        return;
      }

      // prefetch(1) — process one message at a time
      // prevents overwhelming the service if a burst of messages arrives
      await channel.prefetch(1);

      // Declare exchange (must match App 1 exactly)
      await channel.assertExchange(RABBITMQ_EXCHANGES.CHAT, 'topic', {
        durable: true,
      });

      // Declare the queue — durable so it survives RabbitMQ restarts
      await channel.assertQueue(this.QUEUE_NAME, {
        durable: true,
        arguments: {
          // Dead-letter exchange — messages that fail go here
          'x-dead-letter-exchange': 'chat.dlx',
        },
      });

      // Bind queue to exchange with routing key
      await channel.bindQueue(
        this.QUEUE_NAME,
        RABBITMQ_EXCHANGES.CHAT,
        RABBITMQ_ROUTING_KEYS.MESSAGE_SENT,
      );

      // Start consuming
      await channel.consume(this.QUEUE_NAME, async (msg) => {
        if (!msg) return;

        try {
          const payload: MessageSentPayload = JSON.parse(
            msg.content.toString(),
          );

          if (this.handler) {
            await this.handler(payload);
          }

          // ack — tell RabbitMQ the message was processed successfully
          channel.ack(msg);
        } catch (err: any) {
          console.error('Failed to process message', err.message);
          // nack with requeue: false — sends to dead-letter queue
          // instead of requeueing infinitely on a broken message
          channel.nack(msg, false, false);
        }
      });

      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error', err.message);
      });

      this.connection.on('close', () => {
        console.warn('RabbitMQ connection closed — reconnecting in 5s');
        setTimeout(() => this.connect(), 5000);
      });

      console.log(`RabbitMQ connected — consuming [${this.QUEUE_NAME}]`);
    } catch (err: any) {
      console.error('RabbitMQ connection failed — retrying in 5s', err.message);
      setTimeout(() => this.connect(), 5000);
    }
  }

   private async disconnect() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore on shutdown
    }
  }

}
