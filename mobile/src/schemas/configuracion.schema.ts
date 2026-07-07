import { z } from 'zod';
import type { output } from 'zod';

export const configuracionSchema = z.object({
  tasaInteresBase: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%'),
  moraPorcentajeMensual: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%'),
  diasGracia: z
    .number()
    .int('Debe ser un número entero')
    .min(0, 'Mínimo 0 días')
    .max(30, 'Máximo 30 días'),
  permitirAbonoCapital: z.boolean(),
  montoMinimoPrestamo: z.number().min(0, 'Mínimo 0').optional(),
  montoMaximoPrestamo: z.number().min(0, 'Mínimo 0').nullable().optional(),
  montoMaximoPago: z.number().min(0, 'Mínimo 0').nullable().optional(),
});

export type ConfiguracionFormData = output<typeof configuracionSchema>;
