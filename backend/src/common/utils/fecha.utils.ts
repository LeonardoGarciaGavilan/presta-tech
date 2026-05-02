import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TIMEZONE = 'America/Santo_Domingo';

export const getFechaRD = (date: Date | string = new Date()): string => {
  const dateObj = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE);
  return format(zonedDate, 'yyyy-MM-dd');
};

export const getInicioDiaRD = (fecha?: string): Date => {
  let fechaBase: Date;
  
  if (fecha) {
    fechaBase = new Date(`${fecha}T12:00:00`);
  } else {
    const now = new Date();
    fechaBase = toZonedTime(now, TIMEZONE);
  }
  
  const inicioDiaRD = startOfDay(fechaBase);
  const inicioUTC = fromZonedTime(inicioDiaRD, TIMEZONE);
  
  /*console.log('RANGO CORRECTO RD - getInicioDiaRD:', {
    fechaBase: fechaBase.toISOString(),
    inicioDiaRD: inicioDiaRD.toISOString(),
    inicioUTC: inicioUTC.toISOString(),
  }); */
  
  return inicioUTC;
};

export const getFinDiaRD = (fecha?: string): Date => {
  let fechaBase: Date;
  
  if (fecha) {
    fechaBase = new Date(`${fecha}T12:00:00`);
  } else {
    const now = new Date();
    fechaBase = toZonedTime(now, TIMEZONE);
  }
  
  const finDiaRD = endOfDay(fechaBase);
  const finUTC = fromZonedTime(finDiaRD, TIMEZONE);
  
  /*console.log('RANGO CORRECTO RD - getFinDiaRD:', {
    fechaBase: fechaBase.toISOString(),
    finDiaRD: finDiaRD.toISOString(),
    finUTC: finUTC.toISOString(),
  }); */
  
  return finUTC;
};