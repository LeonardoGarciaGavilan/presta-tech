import { Module } from '@nestjs/common';
import { UbicacionesService } from './ubicaciones.service';
import { UbicacionesController } from './ubicaciones.controller';

@Module({
  controllers: [UbicacionesController],
  providers: [UbicacionesService],
  exports: [UbicacionesService],
})
export class UbicacionesModule {}
