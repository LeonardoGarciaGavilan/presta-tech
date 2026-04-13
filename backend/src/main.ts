// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
const app = await NestFactory.create(AppModule);

const expressApp = app.getHttpAdapter().getInstance();
expressApp.set('trust proxy', 1);

  // 🔒 VALIDAR JWT_SECRET EN STARTUP — si no existe, fallar inmediatamente
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('🔒 ERROR CRÍTICO: JWT_SECRET no está configurado en variables de entorno');
    console.error('🔒 La aplicación no puede iniciar sin JWT_SECRET configurado');
    process.exit(1);
  }
  if (jwtSecret === 'super_secret_key' || jwtSecret.length < 32) {
    console.error('🔒 ERROR CRÍTICO: JWT_SECRET demasiado débil. Debe tener al menos 32 caracteres');
    process.exit(1);
  }
  console.log('🔒 JWT_SECRET validado correctamente en startup');

  // 🔒 Cookie parser - NECESARIO para leer cookies httpOnly
  app.use(cookieParser());

  // 🔒 Headers HTTP de seguridad (XSS, clickjacking, MIME sniffing, etc.)
  app.use(helmet());

  // 🔒 WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // 🔒 Validación global de DTOs — rechaza campos no declarados
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,              // elimina campos no declarados en el DTO
    forbidNonWhitelisted: true,   // lanza error si llegan campos extra
    transform: true,              // convierte tipos automáticamente (string → number, etc.)
  }));

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_LOCAL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
}
bootstrap();