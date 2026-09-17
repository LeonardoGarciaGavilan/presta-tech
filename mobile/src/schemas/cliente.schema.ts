import { z } from 'zod';
import type { output } from 'zod';

export const clienteSchema = z.object({
  nombre: z
    .string('El nombre es requerido')
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  cedula: z
    .string('La cédula es requerida')
    .min(1, 'La cédula es requerida')
    .max(20, 'Máximo 20 caracteres'),
  apellido: z
    .string('El apellido es requerido')
    .min(1, 'El apellido es requerido')
    .max(100, 'Máximo 100 caracteres'),
  telefono: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .optional(),
  celular: z
    .string('El celular es requerido')
    .min(1, 'El celular es requerido')
    .max(20, 'Máximo 20 caracteres'),
  email: z
    .string()
    .email('Ingrese un email válido')
    .optional()
    .or(z.literal('')),
  provincia: z
    .string('Selecciona una provincia')
    .min(1, 'Selecciona una provincia')
    .max(100, 'Máximo 100 caracteres'),
  municipio: z
    .string('Selecciona un municipio')
    .min(1, 'Selecciona un municipio')
    .max(100, 'Máximo 100 caracteres'),
  sector: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  // Ids del catálogo RD (Fase 2): opcionales; los clientes legacy solo tienen
  // los nombres.
  provinciaId: z.string().optional().or(z.literal('')),
  municipioId: z.string().optional().or(z.literal('')),
  sectorId: z.string().optional().or(z.literal('')),
  direccion: z
    .string('La dirección es requerida')
    .min(1, 'La dirección es requerida')
    .max(255, 'Máximo 255 caracteres'),
  ocupacion: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  empresaLaboral: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  ingresos: z.preprocess(
    (v) => {
      if (v === '' || v === undefined || v === null) return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    },
    z.number('Ingrese los ingresos mensuales')
      .min(0, 'Debe ser mayor o igual a 0'),
  ),
  observaciones: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
});

export type ClienteFormData = output<typeof clienteSchema>;
