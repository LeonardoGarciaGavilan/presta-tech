import { IsNumber, IsBoolean, IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpsertConfiguracionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  tasaInteresBase: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  moraPorcentajeMensual: number;

  @IsInt()
  @Min(0)
  @Max(30)
  diasGracia: number;

  @IsBoolean()
  permitirAbonoCapital: boolean;

  @IsOptional()
  @IsNumber()
  montoMinimoPrestamo?: number;

  @IsOptional()
  @IsNumber()
  montoMaximoPrestamo?: number;

  @IsOptional()
  @IsNumber()
  montoMaximoPago?: number;
}
