import { z } from 'zod';
import type { output } from 'zod';

export const changePasswordSchema = z
  .object({
    nuevaPassword: z
      .string()
      .min(1, 'La contraseña es requerida')
      .min(6, 'Mínimo 6 caracteres'),
    confirmarPassword: z.string().min(1, 'Debe confirmar la contraseña'),
  })
  .refine((data) => data.nuevaPassword === data.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  });

export type ChangePasswordFormData = output<typeof changePasswordSchema>;
