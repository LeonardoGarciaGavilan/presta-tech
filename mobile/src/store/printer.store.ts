import { create } from 'zustand';

import { direccionConTransporte } from '@/services/printer.service';
import storage from '@/utils/storage';

const PRINTER_STORAGE_KEY = 'printer_config';

export interface PrinterConfig {
  address: string;
  name: string;
}

let memoryCache: PrinterConfig | null | undefined;

async function readConfig(): Promise<PrinterConfig | null> {
  if (memoryCache !== undefined) return memoryCache;
  try {
    const raw = await storage.getItem(PRINTER_STORAGE_KEY);
    const config = raw ? (JSON.parse(raw) as PrinterConfig) : null;
    memoryCache = config ? normalizeConfig(config) : null;
  } catch {
    memoryCache = null;
  }
  return memoryCache;
}

function normalizeConfig(config: PrinterConfig): PrinterConfig {
  return {
    ...config,
    address: direccionConTransporte(config.address),
  };
}

interface PrinterState {
  printer: PrinterConfig | null;
  isReady: boolean;
  hydrate: () => Promise<void>;
  setPrinter: (config: PrinterConfig) => Promise<void>;
  clearPrinter: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  printer: null,
  isReady: false,

  hydrate: async () => {
    const config = await readConfig();
    set({ printer: config, isReady: true });
  },

  setPrinter: async (config) => {
    const normalized = normalizeConfig(config);
    memoryCache = normalized;
    try {
      await storage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Persistencia best-effort: la config sigue actuando en memoria
    }
    set({ printer: normalized });
  },

  clearPrinter: async () => {
    memoryCache = null;
    try {
      await storage.removeItem(PRINTER_STORAGE_KEY);
    } catch {
      // best-effort
    }
    set({ printer: null });
  },
}));