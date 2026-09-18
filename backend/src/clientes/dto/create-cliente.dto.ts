import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  apellido: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  cedula: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  celular: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  provincia: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  municipio: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsString()
  provinciaId?: string;

  @IsOptional()
  @IsString()
  municipioId?: string;

  @IsOptional()
  @IsString()
  sectorId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ocupacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  empresaLaboral?: string;

  @IsNumber()
  @Min(0)
  ingresos: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud?: number;

  /**
   * true  → coords guardadas automáticamente por geocodificación (aproximadas)
   * false → coords marcadas manualmente por el usuario en el mapa (exactas)
   * Solo Rutas.jsx lo envía como true; Clientes.jsx nunca lo envía (default false)
   */
  @IsOptional()
  @IsBoolean()
  coordsAproximadas?: boolean;
}
