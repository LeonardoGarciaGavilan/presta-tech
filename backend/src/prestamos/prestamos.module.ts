import { Module } from '@nestjs/common';
import { PrestamosService } from './prestamos.service';
import { PrestamosController } from './prestamos.controller';
import { MoraCronService } from './mora-cron.service';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    AlertsModule,
    NotificacionesModule,
  ],
  controllers: [PrestamosController],
  providers: [PrestamosService, MoraCronService],
  exports: [PrestamosService],
})
export class PrestamosModule {}