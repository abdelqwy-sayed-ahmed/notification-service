import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationGateway } from './gateway/gateway.gateway';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const port = process.env.PORT??5000
  await app.listen(port);

    // After listen() — Socket.io server is now fully initialized
  const gateway = app.get(NotificationGateway);
  gateway.initAdapter();

  console.log(`Notification service running on port ${port}`);

}
bootstrap();
