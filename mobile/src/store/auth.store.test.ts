import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/auth.types';

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    nombre: 'Test User',
    rol: 'ADMIN',
    empresa: null,
    empresaId: 'emp-1',
    ...overrides,
  };
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      needsPasswordChange: false,
    });
  });

  it('starts with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isHydrated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.needsPasswordChange).toBe(false);
  });

  it('sets user on login', () => {
    const user = createMockUser();
    useAuthStore.getState().setUser(user);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears user on clearUser', () => {
    const user = createMockUser();
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().clearUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.needsPasswordChange).toBe(false);
  });

  it('marks hydration complete', () => {
    useAuthStore.getState().setHydrated();
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('sets loading state', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets needsPasswordChange', () => {
    useAuthStore.getState().setNeedsPasswordChange(true);
    expect(useAuthStore.getState().needsPasswordChange).toBe(true);
  });

  it('setUser with null clears auth', () => {
    useAuthStore.getState().setUser(createMockUser());
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setUser replaces previous user state', () => {
    const initial = createMockUser({ nombre: 'Initial Name' });
    useAuthStore.getState().setUser(initial);

    const updated = createMockUser({ nombre: 'Updated Name' });
    useAuthStore.getState().setUser(updated);

    const state = useAuthStore.getState();
    expect(state.user?.nombre).toBe('Updated Name');
    expect(state.isAuthenticated).toBe(true);
  });

  it('clearUser does not affect hydration status', () => {
    useAuthStore.getState().setHydrated();
    useAuthStore.getState().setUser(createMockUser());
    useAuthStore.getState().clearUser();

    expect(useAuthStore.getState().isHydrated).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
