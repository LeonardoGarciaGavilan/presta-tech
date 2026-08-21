jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    fetch: jest.fn().mockResolvedValue({}),
  },
}));

import NetInfo from '@react-native-community/netinfo';
import { getNetworkStatus, subscribeToNetwork } from '@/hooks/use-network-status';

const mockAddEventListener = (NetInfo as any).addEventListener as jest.Mock;

let notify: (state: any) => void;

beforeAll(() => {
  mockAddEventListener.mockImplementation((listener: any) => {
    notify = listener;
    return () => {};
  });
  subscribeToNetwork(() => {});
});

describe('mapeo de estados NetInfo (C5)', () => {
  it('conectado con internet verificable → online', () => {
    notify({ isConnected: true, isInternetReachable: true, type: 'wifi' });
    expect(getNetworkStatus().isOnline).toBe(true);
  });

  it('conectado pero isInternetReachable null → offline (2.6: sin evidencia, encola)', () => {
    notify({ isConnected: true, isInternetReachable: null, type: 'cellular' });
    expect(getNetworkStatus().isOnline).toBe(false);
  });

  it('conectado pero isInternetReachable false → offline', () => {
    notify({ isConnected: true, isInternetReachable: false, type: 'cellular' });
    expect(getNetworkStatus().isOnline).toBe(false);
  });

  it('desconectado → offline', () => {
    notify({ isConnected: false, isInternetReachable: false, type: 'none' });
    expect(getNetworkStatus().isOnline).toBe(false);
  });
});
