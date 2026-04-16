import { format, fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TIMEZONE = 'America/Santo_Domingo';

export const getFechaRD = (date: Date | string = new Date()): string => {
  const dateObj = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const utcDate = fromZonedTime(dateObj, TIMEZONE);
  return format(new Date(utcDate), 'yyyy-MM-dd');
};

export const getInicioDiaRD = (fecha?: string): Date => {
  const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
  const inicioLocal = startOfDay(base);
  return fromZonedTime(inicioLocal, TIMEZONE);
};

export const getFinDiaRD = (fecha?: string): Date => {
  const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
  const finLocal = endOfDay(base);
  return fromZonedTime(finLocal, TIMEZONE);
};

const inicio = getInicioDiaRD();
const fin = getFinDiaRD();
console.log('RANGO CORRECTO fecha.utils:', {
  inicio: inicio.toISOString(),
  fin: fin.toISOString(),
});