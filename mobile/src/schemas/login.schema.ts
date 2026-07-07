import { z } from 'zod';
import type { output } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'El email es requerido').email('Ingrese un email válido'),
  password: z.string().min(1, 'La contraseña es requerida').min(6, 'Mínimo 6 caracteres'),
});

export type LoginFormData = output<typeof loginSchema>;
