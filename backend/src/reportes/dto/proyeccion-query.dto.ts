import { IsOptional, IsString } from 'class-validator';

export class ProyeccionQueryDto {
  @IsOptional()
  @IsString()
  provincia?: string;
}
