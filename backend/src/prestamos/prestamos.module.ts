import { Module } from '@nestjs/common';
import { PrestamosService } from './prestamos.service';
import { PrestamosController } from './prestamos.controller';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    AlertsModule,
  ],
  controllers: [PrestamosController],
  providers: [PrestamosService],
  exports: [PrestamosService],
})
export class PrestamosModule {}