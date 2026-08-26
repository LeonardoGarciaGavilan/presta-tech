import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FlujoCajaQueryDto {
  @IsDateString()
  desde: string;

  @IsDateString()
  hasta: string;

  @IsOptional()
  @IsString()
  usuarioId?: string;
}
