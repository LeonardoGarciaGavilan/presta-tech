export type Rol = 'SUPERADMIN' | 'ADMIN' | 'EMPLEADO';

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  empresa: string | null;
  empresaId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  usuario: User;
  requiereCambioPassword?: boolean;
  esSuperAdmin?: boolean;
  mensaje?: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  needsPasswordChange: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setNeedsPasswordChange: (needs: boolean) => void;
  setHydrated: () => void;
}

export type LoginError = {
  message: string;
  statusCode: number;
  minutosRestantes?: number;
  code?: string;
};
