// src/prestamos/dto/renovar-prestamo.dto.ts
import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class RenovarPrestamoDto {
  /** Monto del préstamo nuevo. Debe ser mayor al saldo anterior aplicado. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  montoNuevo: number;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  tasaInteres: number;

  @IsNumber()
  @Min(1)
  numeroCuotas: number;

  @IsOptional()
  @IsEnum(FrecuenciaPago)
  frecuenciaPago?: FrecuenciaPago;

  /** Fecha ISO (YYYY-MM-DD) de inicio del nuevo préstamo. Default: hoy. */
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
