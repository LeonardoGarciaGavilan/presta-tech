import {
  IsString, IsOptional, MinLength, IsNotEmpty,
} from 'class-validator';

export class UpdatePerfilDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;
}

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty()
  passwordActual: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  passwordNuevo: string;
}

export class UpdateEmpresaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;
}