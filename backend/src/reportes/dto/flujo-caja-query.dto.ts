import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ValidarRango } from './validar-rango.decorator';

export class FlujoCajaQueryDto {
  @ValidarRango({ maxDias: 366 })
  @IsDateString()
  desde: string;

  @IsDateString()
  hasta: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;
}
