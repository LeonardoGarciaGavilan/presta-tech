import { IsNumber, IsPositive, IsString, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInyeccionDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  monto: number;

  @IsString()
  @IsNotEmpty()
  concepto: string;
}