// src/notificaciones/notificaciones.module.ts

import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, PushNotificationsService],
  exports: [PushNotificationsService],
})
export class NotificacionesModule {}