import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DesempenoQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  usuarioId?: string;
}
