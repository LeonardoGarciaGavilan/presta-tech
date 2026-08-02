import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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

  /**
   * Fecha (YYYY-MM-DD) en que se realizó el pago, en zona de República Dominicana.
   * El sync offline la envía para asociar el pago a la caja del día correcto.
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha?: string;

  /**
   * Clave de idempotencia (usada por el sync offline para evitar duplicados).
   * Si ya existe un pago con esta clave para el préstamo, se devuelve el
   * existente en lugar de crear uno nuevo.
   */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}