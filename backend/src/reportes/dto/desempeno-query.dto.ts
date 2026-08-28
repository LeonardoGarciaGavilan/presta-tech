import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ValidarRango } from './validar-rango.decorator';

export class DesempenoQueryDto {
  @ValidarRango({ maxDias: 366 })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;
}
