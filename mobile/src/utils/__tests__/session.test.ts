jest.mock('@/db/purge', () => ({
  purgeAllTables: jest.fn(),
}));

jest.mock('@/utils/token-storage', () => ({
  tokenStorage: {
    clearTokens: jest.fn(),
  },
}));

import { clearSession } from '@/utils/session';
import { tokenStorage } from '@/utils/token-storage';
import { purgeAllTables } from '@/db/purge';
import { useAuthStore } from '@/store/auth.store';

const mockClearTokens = tokenStorage.clearTokens as jest.Mock;
const mockPurgeAllTables = purgeAllTables as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().clearUser();
});

describe('clearSession (C4)', () => {
  it('purga la DB, borra los tokens y limpia el usuario', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'user_1' } as any });

    await clearSession();

    expect(mockClearTokens).toHaveBeenCalled();
    expect(mockPurgeAllTables).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('sigue limpiando aunque falle la purga de la DB', async () => {
    mockClearTokens.mockResolvedValue(undefined);
    mockPurgeAllTables.mockRejectedValue(new Error('db locked'));

    await expect(clearSession()).resolves.toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
