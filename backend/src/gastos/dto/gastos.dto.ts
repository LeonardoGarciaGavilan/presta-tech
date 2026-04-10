import {
  IsString, IsNumber, IsNotEmpty, IsOptional,
  IsDateString, Min,
} from 'class-validator';

export class CreateGastoDto {
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto: number;

  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateGastoDto {
  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}