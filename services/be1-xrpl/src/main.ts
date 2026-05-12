import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { WalletAppModule } from './wallet-app.module';

function corsOrigins() {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:5179,http://127.0.0.1:5179')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const appModule = process.env.BE1_WALLET_ONLY === '1' ? WalletAppModule : AppModule;
  const app = await NestFactory.create(appModule);
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
