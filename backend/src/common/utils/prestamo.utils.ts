// src/common/utils/prestamo.utils.ts

export function calcularDesdeObjeto(prestamo: any): { saldoPendiente: number; moraAcumulada: number } {
  const cuotasPendientes = prestamo.cuotas?.filter((c: any) => !c.pagada) ?? [];
  
  const saldo = cuotasPendientes.reduce(
    (sum: number, c: any) => sum + c.capital + c.interes + (c.mora || 0),
    0,
  );
  
  const mora = cuotasPendientes.reduce(
    (sum: number, c: any) => sum + (c.mora || 0),
    0,
  );
  
  return {
    saldoPendiente: Math.round(saldo * 100) / 100,
    moraAcumulada: Math.round(mora * 100) / 100,
  };
}

export function calcularSaldoDesdeCuotas(cuotas: any[]): number {
  const cuotasPendientes = cuotas.filter((c: any) => !c.pagada);
  const saldo = cuotasPendientes.reduce(
    (sum: number, c: any) => sum + c.capital + c.interes + (c.mora || 0),
    0,
  );
  return Math.round(saldo * 100) / 100;
}

export function calcularMoraDesdeCuotas(cuotas: any[]): number {
  const cuotasPendientes = cuotas.filter((c: any) => !c.pagada);
  const mora = cuotasPendientes.reduce(
    (sum: number, c: any) => sum + (c.mora || 0),
    0,
  );
  return Math.round(mora * 100) / 100;
}
