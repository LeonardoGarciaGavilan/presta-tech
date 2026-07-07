import { tokenStorage } from '@/utils/token-storage';
import { AUTH_STORAGE_KEYS } from '@/constants/auth.constants';
import storage from '@/utils/storage';

jest.mock('@/utils/storage', () => {
  const store: Record<string, string | null> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
    },
  };
});

const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('tokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    return tokenStorage.clearTokens();
  });

  describe('getAccessToken', () => {
    it('returns null initially', async () => {
      const token = await tokenStorage.getAccessToken();
      expect(token).toBeNull();
    });

    it('returns stored token', async () => {
      await tokenStorage.setAccessToken('my-token');
      const token = await tokenStorage.getAccessToken();
      expect(token).toBe('my-token');
    });

    it('uses cache on second call', async () => {
      await tokenStorage.setAccessToken('cached-token');
      jest.clearAllMocks();

      const token = await tokenStorage.getAccessToken();
      expect(token).toBe('cached-token');
      expect(mockedStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('setAccessToken', () => {
    it('stores token with correct key', async () => {
      await tokenStorage.setAccessToken('new-token');

      expect(mockedStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
        'new-token',
      );
    });
  });

  describe('removeAccessToken', () => {
    it('removes token', async () => {
      await tokenStorage.setAccessToken('some-token');
      jest.clearAllMocks();

      await tokenStorage.removeAccessToken();

      expect(mockedStorage.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      );
    });
  });

  describe('getRefreshToken', () => {
    it('returns stored refresh token', async () => {
      await tokenStorage.setRefreshToken('refresh-123');
      const token = await tokenStorage.getRefreshToken();
      expect(token).toBe('refresh-123');
    });

    it('returns null when no refresh token', async () => {
      const token = await tokenStorage.getRefreshToken();
      expect(token).toBeNull();
    });
  });

  describe('setRefreshToken', () => {
    it('stores refresh token with correct key', async () => {
      await tokenStorage.setRefreshToken('refresh-456');

      expect(mockedStorage.setItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.REFRESH_TOKEN,
        'refresh-456',
      );
    });
  });

  describe('removeRefreshToken', () => {
    it('removes refresh token', async () => {
      await tokenStorage.removeRefreshToken();

      expect(mockedStorage.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.REFRESH_TOKEN,
      );
    });
  });

  describe('clearTokens', () => {
    it('removes both tokens', async () => {
      await tokenStorage.clearTokens();

      expect(mockedStorage.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.ACCESS_TOKEN,
      );
      expect(mockedStorage.removeItem).toHaveBeenCalledWith(
        AUTH_STORAGE_KEYS.REFRESH_TOKEN,
      );
    });

    it('resets memory cache', async () => {
      await tokenStorage.setAccessToken('acc');
      await tokenStorage.setRefreshToken('ref');
      await tokenStorage.clearTokens();

      mockedStorage.getItem.mockResolvedValue(null);
      const accToken = await tokenStorage.getAccessToken();
      const refToken = await tokenStorage.getRefreshToken();
      expect(accToken).toBeNull();
      expect(refToken).toBeNull();
    });
  });
});
