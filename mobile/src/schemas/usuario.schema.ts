import { z } from 'zod';

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  email: z.string().min(1, 'El email es requerido').email('Ingrese un email válido'),
  rol: z.enum(['ADMIN', 'EMPLEADO'], { message: 'Seleccione un rol' }),
});

export type CrearUsuarioFormData = z.output<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  rol: z.enum(['ADMIN', 'EMPLEADO'], { message: 'Seleccione un rol' }),
  activo: z.boolean(),
});

export type EditarUsuarioFormData = z.output<typeof editarUsuarioSchema>;
