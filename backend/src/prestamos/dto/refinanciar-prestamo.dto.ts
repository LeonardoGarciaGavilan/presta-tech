// src/prestamos/dto/refinanciar-prestamo.dto.ts
import {
  IsNumber, IsOptional, IsString, IsEnum, IsDateString,
  Min, Max,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class RefinanciarPrestamoDto {
  @IsNumber()
  @Min(1)
  nuevasCuotas: number;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  nuevaTasa: number;

  @IsOptional()
  @IsEnum(FrecuenciaPago)
  nuevaFrecuencia?: FrecuenciaPago;

  /**
   * Fecha ISO para la próxima cuota pendiente (YYYY-MM-DD).
   * Si se envía, solo mueve la fecha de la primera cuota pendiente.
   * Las demás se recalculan a partir de esa nueva fecha.
   */
  @IsOptional()
  @IsDateString()
  nuevaFechaPago?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}