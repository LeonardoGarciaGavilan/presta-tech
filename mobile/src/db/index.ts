import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DATABASE_NAME = 'prestadb.db';

const expo = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

export const db = drizzle(expo, { schema });

export { DATABASE_NAME };
