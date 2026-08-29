import { usePrinterStore } from '@/store/printer.store';

const CONFIG = { address: 'bt:00:11:22:33:44:55', name: 'Jaclink 2C-P210' };

describe('printerStore', () => {
  beforeEach(async () => {
    await usePrinterStore.getState().clearPrinter();
  });

  it('starts with default state', () => {
    expect(usePrinterStore.getState().printer).toBeNull();
    expect(usePrinterStore.getState().isReady).toBe(false);
  });

  it('hydrates when no config is stored', async () => {
    await usePrinterStore.getState().hydrate();
    expect(usePrinterStore.getState().isReady).toBe(true);
    expect(usePrinterStore.getState().printer).toBeNull();
  });

  it('sets printer config', async () => {
    await usePrinterStore.getState().setPrinter(CONFIG);
    expect(usePrinterStore.getState().printer).toEqual(CONFIG);
  });

  it('normaliza la dirección al persistir (bt: para MAC cruda)', async () => {
    await usePrinterStore.getState().setPrinter({ address: '00:11:22:33:44:55', name: 'Jaclink 2C-P210' });
    expect(usePrinterStore.getState().printer).toEqual(CONFIG);
  });

  it('hydrate restores persisted config y migra MAC cruda', async () => {
    await usePrinterStore.getState().setPrinter({ address: '00:11:22:33:44:55', name: 'Jaclink 2C-P210' });
    usePrinterStore.setState({ printer: null, isReady: false });
    await usePrinterStore.getState().hydrate();
    expect(usePrinterStore.getState().printer).toEqual(CONFIG);
  });

  it('clearPrinter removes persisted config', async () => {
    await usePrinterStore.getState().setPrinter(CONFIG);
    await usePrinterStore.getState().clearPrinter();
    expect(usePrinterStore.getState().printer).toBeNull();
    usePrinterStore.setState({ isReady: false });
    await usePrinterStore.getState().hydrate();
    expect(usePrinterStore.getState().printer).toBeNull();
  });

  it('setPrinter replaces previous config', async () => {
    await usePrinterStore.getState().setPrinter(CONFIG);
    const otro = { address: 'bt:66:77:88:99:00:11', name: '2Connect 58' };
    await usePrinterStore.getState().setPrinter(otro);
    expect(usePrinterStore.getState().printer).toEqual(otro);
  });
});