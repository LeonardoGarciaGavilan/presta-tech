import { format, toZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TIMEZONE_RD = 'America/Santo_Domingo';

export const getFechaRD = (date = new Date()): string => {
  const zonedDate = toZonedTime(date, TIMEZONE_RD);
  return format(zonedDate, 'yyyy-MM-dd');
};

export const getInicioDiaRD = (date = new Date()): Date => {
  const zonedDate = toZonedTime(date, TIMEZONE_RD);
  return startOfDay(zonedDate);
};

export const getFinDiaRD = (date = new Date()): Date => {
  const zonedDate = toZonedTime(date, TIMEZONE_RD);
  return endOfDay(zonedDate);
};