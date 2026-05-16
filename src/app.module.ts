import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
     ConfigModule.forRoot({
      isGlobal: true, 
    }),
    RabbitMQModule,
    RedisModule,
    GatewayModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
