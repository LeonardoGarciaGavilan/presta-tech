import { z } from 'zod';
import type { output } from 'zod';

export const clienteSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'Máximo 100 caracteres'),
  cedula: z
    .string()
    .min(1, 'La cédula es requerida')
    .max(20, 'Máximo 20 caracteres'),
  apellido: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  telefono: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .optional(),
  celular: z
    .string()
    .max(20, 'Máximo 20 caracteres')
    .optional(),
  email: z
    .string()
    .email('Ingrese un email válido')
    .optional()
    .or(z.literal('')),
  provincia: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  municipio: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  sector: z
    .string()
    .max(100, 'Máximo 100 caracteres')
    .optional(),
  direccion: z
    .string()
    .max(255, 'Máximo 255 caracteres')
    .optional(),
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
    z
      .number()
      .min(0, 'Debe ser mayor o igual a 0')
      .optional(),
  ),
  observaciones: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
});

export type ClienteFormData = output<typeof clienteSchema>;
