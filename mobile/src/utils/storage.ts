import { Platform } from 'react-native';

interface IStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function createStorage(): IStorage {
  if (Platform.OS === 'web') {
    return {
      getItem: async (key) => localStorage.getItem(key),
      setItem: async (key, value) => {
        localStorage.setItem(key, value);
      },
      removeItem: async (key) => {
        localStorage.removeItem(key);
      },
    };
  }

  const SecureStore = require('expo-secure-store');
  const options = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  return {
    getItem: (key: string) => SecureStore.getItemAsync(key, options),
    setItem: (key: string, value: string) =>
      SecureStore.setItemAsync(key, value, options),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key, options),
  };
}

const storage = createStorage();

export default storage;
