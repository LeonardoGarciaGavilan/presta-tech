import { format, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TIMEZONE_RD = 'America/Santo_Domingo';

export const getFechaRD = (date: Date | string = new Date()): string => {
  const dateObj = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE_RD);
  return format(zonedDate, 'yyyy-MM-dd');
};

export const getInicioDiaRD = (date: Date | string = new Date()): Date => {
  const dateObj = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE_RD);
  return startOfDay(zonedDate);
};

export const getFinDiaRD = (date: Date | string = new Date()): Date => {
  const dateObj = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE_RD);
  return endOfDay(zonedDate);
};