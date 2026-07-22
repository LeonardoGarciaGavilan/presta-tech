import client from './client';
import { AUTH_API } from '@/constants/auth.constants';
import { tokenStorage } from '@/utils/token-storage';
import type {
  LoginRequest,
  LoginResponse,
  User,
} from '@/types/auth.types';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await client.post<LoginResponse>(AUTH_API.LOGIN, data);

  const { access_token, refresh_token } = response.data;

  await Promise.all([
    tokenStorage.setAccessToken(access_token),
    tokenStorage.setRefreshToken(refresh_token),
  ]);

  return response.data;
}

export async function logout(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();

  await client.post(AUTH_API.LOGOUT, {
    refresh_token: refreshToken,
  });
}

export async function logoutAll(): Promise<void> {
  await client.post(AUTH_API.LOGOUT_ALL);
}

export async function clearPushToken(): Promise<void> {
  await client.delete('/usuarios/push-token');
}

export async function getCurrentUser(): Promise<User> {
  const response = await client.get<User>(AUTH_API.ME);
  return response.data;
}
