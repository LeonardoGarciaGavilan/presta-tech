// src/alerts/alerts.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module'; // 👈 importa AuthModule
import { AlertsGateway } from './alerts.gateway';

@Module({
  imports: [AuthModule],   // 👈 ya trae JwtModule configurado con el secret correcto
  providers: [AlertsGateway],
  exports: [AlertsGateway],
})
export class AlertsModule {}