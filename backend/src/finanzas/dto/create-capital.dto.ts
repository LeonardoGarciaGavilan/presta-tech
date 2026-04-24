import { IsNumber, IsPositive, IsString, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCapitalInicialDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  capitalInicial: number;

  @IsString()
  @IsNotEmpty()
  observaciones?: string;
}