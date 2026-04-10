import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { MetodoPago } from '@prisma/client';

export class CreatePagoDto {
  /** ID del préstamo al que se aplica el pago */
  @IsUUID()
  prestamoId: string;

  /**
   * ID de la cuota específica a pagar (opcional).
   * Si no se envía, el sistema aplica a la próxima cuota pendiente.
   */
  @IsOptional()
  @IsUUID()
  cuotaId?: string;

  /** Monto total que entrega el cliente */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPagado: number;

  @IsEnum(MetodoPago)
  metodo: MetodoPago;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}