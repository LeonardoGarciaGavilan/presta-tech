import { IsString, IsOptional, IsEmail, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsString()
  cedula: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  celular?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  ocupacion?: string;

  @IsOptional()
  @IsString()
  empresaLaboral?: string;

  @IsOptional()
  @IsNumber()
  ingresos?: number;

  @IsOptional()
  @IsString()
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