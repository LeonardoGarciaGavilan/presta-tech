import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { imprimirDocumento, mensajeErrorImpresora } from '@/services/printer.service';
import { usePrinterStore } from '@/store/printer.store';
import { imprimirAirPrint } from '@/utils/recibo-pdf';
import type { ReciboImprimible } from '@/utils/recibo-pdf';

export type ImprimirReciboResultado =
  | { ok: true }
  | { ok: false; motivo: 'sin-impresora' | 'error' | 'permiso'; mensaje: string };

async function asegurarPermisoConexion(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 31) return true;

  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  if (granted) return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useImprimirRecibo() {
  const printer = usePrinterStore((state) => state.printer);
  const [imprimiendo, setImprimiendo] = useState(false);

  const imprimir = useCallback(
    async (recibo: ReciboImprimible): Promise<ImprimirReciboResultado> => {
      await usePrinterStore.getState().hydrate();
      if (Platform.OS === 'ios') {
        try {
          await imprimirAirPrint(recibo);
          return { ok: true };
        } catch (error) {
          return { ok: false, motivo: 'error', mensaje: mensajeErrorImpresora(error) };
        }
      }
      const config = usePrinterStore.getState().printer;
      if (!config) {
        return { ok: false, motivo: 'sin-impresora', mensaje: 'No hay impresora configurada' };
      }
      const permisoOk = await asegurarPermisoConexion();
      if (!permisoOk) {
        return { ok: false, motivo: 'permiso', mensaje: 'Permiso Bluetooth denegado. Concéndelo en ajustes para imprimir.' };
      }
      setImprimiendo(true);
      try {
        await imprimirDocumento(config.address, recibo.escpos);
        return { ok: true };
      } catch (error) {
        return { ok: false, motivo: 'error', mensaje: mensajeErrorImpresora(error) };
      } finally {
        setImprimiendo(false);
      }
    },
    [],
  );

  return { printer, imprimiendo, imprimir };
}