//create-prestamo.dto.ts
import {
  IsUUID,
  IsNumber,
  IsInt,
  IsPositive,
  Min,
  Max,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { FrecuenciaPago } from '@prisma/client';

export class CreatePrestamoDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  garanteId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  /** Tasa de interés en % según la frecuencia (ej: 5 = 5%) */
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  tasaInteres: number;

  /** Número de cuotas totales */
  @IsInt()
  @Min(1)
  @Max(3650)
  numeroCuotas: number;

  @IsEnum(FrecuenciaPago)
  frecuenciaPago: FrecuenciaPago;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsBoolean()
  modoRapido?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoTotal?: number;
}