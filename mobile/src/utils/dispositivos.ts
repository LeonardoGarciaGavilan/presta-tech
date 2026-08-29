import type { Device, ScanResult } from 'react-native-thermal-printer-driver';

const NOMBRE_DESCONOCIDO = 'Unknown Device';

export function nombreLegible(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === NOMBRE_DESCONOCIDO.toLowerCase()) return '';
  return trimmed;
}

export function fusionarListas(result: ScanResult): { vinculadas: Device[]; detectadas: Device[] } {
  const vinculadas: Device[] = [];
  const direccionesVinculadas = new Set<string>();

  for (const device of result.paired) {
    vinculadas.push({ ...device, name: nombreLegible(device.name) });
    direccionesVinculadas.add(device.address);
  }

  const detectadas: Device[] = [];
  for (const device of result.found) {
    if (direccionesVinculadas.has(device.address)) continue;
    detectadas.push({ ...device, name: nombreLegible(device.name) });
  }

  return { vinculadas, detectadas };
}