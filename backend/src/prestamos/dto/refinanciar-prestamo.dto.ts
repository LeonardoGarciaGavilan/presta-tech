// src/prestamos/dto/refinanciar-prestamo.dto.ts
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class RefinanciarPrestamoDto {
  @IsNumber()
  @Min(1)
  nuevasCuotas: number;

  /**
   * Tasa de interés en % según la frecuencia. Obligatoria en modo normal
   * (0.1-100). En modo rápido se envía 0 u se omite.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nuevaTasa?: number;

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

  /**
   * Modo rápido: cuota fija plana calculada desde montoTotal sobre el saldo
   * refinanciado (igual que crear/renovar préstamo rápido).
   */
  @IsOptional()
  @IsBoolean()
  modoRapido?: boolean;

  /**
   * Total a cobrar en modo rápido. Obligatorio si modoRapido=true; debe
   * superar el saldo refinanciado (capital + mora pendientes).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoTotal?: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}
