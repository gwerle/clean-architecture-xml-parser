import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`GraphQL endpoint ready at http://localhost:${port}/graphql`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
