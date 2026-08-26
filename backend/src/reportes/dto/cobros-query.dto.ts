import { IsOptional, IsString, IsDateString, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CobrosQueryDto {
  @IsDateString({}, { message: 'desde debe ser una fecha válida (YYYY-MM-DD)' })
  desde: string;

  @IsDateString({}, { message: 'hasta debe ser una fecha válida (YYYY-MM-DD)' })
  hasta: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  porPagina?: number;
}
