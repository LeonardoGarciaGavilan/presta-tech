import { waitForRefresh } from '@/api/refresh-manager';

const mockPost = jest.fn();
jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  post: (...args: any[]) => mockPost(...args),
  default: {
    post: (...args: any[]) => mockPost(...args),
  },
}));

jest.mock('@/utils/token-storage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(),
    setAccessToken: jest.fn(),
    setRefreshToken: jest.fn(),
  },
}));
jest.mock('@/utils/session', () => ({
  clearSession: jest.fn(),
}));

import { tokenStorage } from '@/utils/token-storage';
import { clearSession } from '@/utils/session';

const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockedClearSession = clearSession as jest.MockedFunction<typeof clearSession>;

describe('waitForRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when no refresh token exists', async () => {
    mockedTokenStorage.getRefreshToken.mockResolvedValue(null);

    const result = await waitForRefresh();

    expect(result).toBe(false);
    expect(mockedClearSession).toHaveBeenCalled();
  });

  it('returns true on successful refresh', async () => {
    mockedTokenStorage.getRefreshToken.mockResolvedValue('valid-refresh-token');
    mockPost.mockResolvedValue({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      },
    });

    const result = await waitForRefresh();

    expect(result).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockedTokenStorage.setAccessToken).toHaveBeenCalledWith('new-access');
    expect(mockedTokenStorage.setRefreshToken).toHaveBeenCalledWith('new-refresh');
  });

  it('deduplicates concurrent refresh calls', async () => {
    mockedTokenStorage.getRefreshToken.mockResolvedValue('refresh-token');
    mockPost.mockResolvedValue({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      },
    });

    const [r1, r2] = await Promise.all([
      waitForRefresh(),
      waitForRefresh(),
    ]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('clears session and returns false on refresh failure', async () => {
    mockedTokenStorage.getRefreshToken.mockResolvedValue('refresh-token');
    mockPost.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        response: { status: 401 },
        isAxiosError: true,
      }),
    );

    const result = await waitForRefresh();

    expect(result).toBe(false);
    expect(mockedClearSession).toHaveBeenCalled();
  });
});
