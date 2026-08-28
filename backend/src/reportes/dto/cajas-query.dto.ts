import {
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ValidarRango } from './validar-rango.decorator';

export class CajasQueryDto {
  @ValidarRango({ maxDias: 366 })
  @IsDateString({}, { message: 'desde debe ser una fecha válida (YYYY-MM-DD)' })
  desde: string;

  @IsDateString({}, { message: 'hasta debe ser una fecha válida (YYYY-MM-DD)' })
  hasta: string;

  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  porPagina?: number;
}
