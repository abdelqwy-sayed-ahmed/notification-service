import { Module } from '@nestjs/common';
import { NotificationGateway } from './gateway.gateway';
import { GatewayService } from './gateway.service';

@Module({
  providers: [NotificationGateway, GatewayService],
  exports: [NotificationGateway],
})
export class GatewayModule {}