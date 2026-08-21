import {
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

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

  /** Renovar solo cuando faltan X cuotas o menos. 0 = sin restricción. */
  @IsInt()
  @Min(0)
  @Max(100)
  cuotasRestantesParaRenovar?: number;

  /** Máximo de refinanciamientos por préstamo. 0 = sin límite. */
  @IsInt()
  @Min(0)
  @Max(20)
  maxRefinanciamientosPorPrestamo?: number;

  /**
   * Máximo de préstamos simultáneos por cliente contando solo ACTIVO y ATRASADO.
   * 0 = sin límite.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxPrestamosActivosPorCliente?: number;
}
