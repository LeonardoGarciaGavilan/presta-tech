import { type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from './index';
import { initializeDatabase } from './migrations';

async function onInit(database: SQLiteDatabase) {
  await initializeDatabase(database);
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={onInit}
      useSuspense={true}
    >
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </SQLiteProvider>
  );
}
