import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  // Two separate clients — one for commands, one for pub/sub
  // Redis requires a dedicated client for subscribe mode
  private client: RedisClientType | any;
  private subscriberClient: RedisClientType | any;
  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.subscriberClient?.quit();
  }

  private async connect() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) throw new Error('Redis url is missing');

    this.client = createClient({ url }) as RedisClientType;
    this.subscriberClient = createClient({ url }) as RedisClientType;

    this.client.on('error', (err) =>
      console.error('Redis client error', err.message),
    );
    this.subscriberClient.on('error', (err) =>
      console.error('Redis subscriber error', err.message),
    );

    await this.client.connect();
    await this.subscriberClient.connect();

    console.log('Redis connected');
  }

  // GatewayModule uses these to create the Socket.io Redis adapter
  getClient(): RedisClientType {
    return this.client;
  }

  getSubscriberClient(): RedisClientType {
    return this.subscriberClient;
  }

  // Key pattern: presence:{tenantId}:{userId} = socketId
  private presenceKey(tenantId: string, userId: number): string {
    return `presence:${tenantId}:${userId}`;
  }

  async setUserOnline(
    tenantId: string,
    userId: number,
    socketId: string,
  ): Promise<void> {
    // EX 86400 — expire after 24h as a safety net
    // gets refreshed on every reconnect
    await this.client.set(this.presenceKey(tenantId, userId), socketId, {
      EX: 86400,
    });
  }

  async setUserOffline(tenantId: string, userId: number): Promise<void> {
    await this.client.del(this.presenceKey(tenantId, userId));
  }

  async getSocketId(tenantId: string, userId: number): Promise<string | null> {
    return this.client.get(this.presenceKey(tenantId, userId));
  }

  async getOnlineRecipients(
    tenantId: string,
    userIds: number[],
  ): Promise<{ userId: number; socketId: string }[]> {
    if (userIds.length === 0) return [];

    // Use pipeline to fetch all in one round-trip
    const pipeline = this.client.multi();
    for (const userId of userIds) {
      pipeline.get(this.presenceKey(tenantId, userId));
    }

    const results = await pipeline.exec();

    return userIds
      .map((userId, index) => ({
        userId,
        socketId: results[index] as string | null,
      }))
      .filter((r) => r.socketId !== null) as {
      userId: number;
      socketId: string;
    }[];
  }
}
