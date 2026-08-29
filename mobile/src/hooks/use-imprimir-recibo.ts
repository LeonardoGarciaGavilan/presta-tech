import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { imprimirDocumento, mensajeErrorImpresora } from '@/services/printer.service';
import { usePrinterStore } from '@/store/printer.store';
import { imprimirAirPrint } from '@/utils/recibo-pdf';
import type { ReciboImprimible } from '@/utils/recibo-pdf';

export type ImprimirReciboResultado =
  | { ok: true }
  | { ok: false; motivo: 'sin-impresora' | 'error'; mensaje: string };

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