import {
  IsString, IsEmail, IsEnum, IsOptional,
  IsBoolean, MinLength, IsNotEmpty,
} from 'class-validator';

export enum RolUsuario {
  ADMIN    = 'ADMIN',
  EMPLEADO = 'EMPLEADO',
}

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEmail()
  email: string;

  @IsEnum(RolUsuario)
  rol: RolUsuario;
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  nuevaPassword: string;
}