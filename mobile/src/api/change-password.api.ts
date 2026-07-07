import client from './client';

const USUARIOS_CAMBIAR_PASSWORD = '/usuarios/cambiar-password';

export async function changePassword(nuevaPassword: string): Promise<void> {
  await client.post(USUARIOS_CAMBIAR_PASSWORD, { nuevaPassword });
}
