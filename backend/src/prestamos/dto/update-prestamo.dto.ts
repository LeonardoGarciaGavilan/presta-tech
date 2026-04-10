import { IsEnum, IsOptional } from 'class-validator';
import { EstadoPrestamo } from '@prisma/client';

export class UpdatePrestamoDto {
  @IsOptional()
  @IsEnum(EstadoPrestamo)
  estado?: EstadoPrestamo;
}