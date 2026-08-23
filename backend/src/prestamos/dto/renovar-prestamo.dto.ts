// src/prestamos/dto/renovar-prestamo.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class RenovarPrestamoDto {
  /** Monto del préstamo nuevo. Debe ser mayor al saldo anterior aplicado. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  montoNuevo: number;

  /** Tasa de interés en % según la frecuencia. En modo rápido se envía 0. */
  @IsNumber()
  @Min(0)
  @Max(100)
  tasaInteres: number;

  @IsNumber()
  @Min(1)
  @Max(3650)
  numeroCuotas: number;

  @IsOptional()
  @IsEnum(FrecuenciaPago)
  frecuenciaPago?: FrecuenciaPago;

  /** Fecha ISO (YYYY-MM-DD) de inicio del nuevo préstamo. Default: hoy. */
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  /** Modo rápido: cuota fija plana calculada desde montoTotal (igual que crear préstamo rápido). */
  @IsOptional()
  @IsBoolean()
  modoRapido?: boolean;

  /** Total a cobrar en modo rápido. Obligatorio si modoRapido=true. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoTotal?: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}
