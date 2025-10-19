import { openDatabase, SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'pos_offline.db';
const MIGRATIONS_TABLE = 'schema_migrations';

interface Migration {
  version: number;
  up: string[];
  down: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    up: [
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced)`,
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version INTEGER PRIMARY KEY,
        executed_at INTEGER NOT NULL
      )`
    ],
    down: [
      `DROP TABLE IF EXISTS sync_queue`,
      `DROP TABLE IF EXISTS ${MIGRATIONS_TABLE}`
    ]
  },
  {
    version: 2,
    up: [
      `ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0`,
      `ALTER TABLE sync_queue ADD COLUMN last_error TEXT`
    ],
    down: [
      `CREATE TABLE sync_queue_temp AS 
       SELECT id, type, data, timestamp, synced 
       FROM sync_queue`,
      `DROP TABLE sync_queue`,
      `ALTER TABLE sync_queue_temp RENAME TO sync_queue`
    ]
  }
];

export class SchemaManager {
  private db: SQLiteDatabase;

  constructor() {
    this.db = openDatabase(DB_NAME);
  }

  async getCurrentVersion(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `PRAGMA user_version`,
          [],
          (_, { rows: { _array } }) => {
            resolve(_array[0].user_version);
          },
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  private async setVersion(version: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `PRAGMA user_version = ${version}`,
          [],
          () => resolve(),
          (_, error) => {
            reject(error);
            return false;
          }
        );
      });
    });
  }

  async migrate(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion)
                                      .sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      try {
        await this.executeMigration(migration);
      } catch (error) {
        console.error(`Migration to version ${migration.version} failed:`, error);
        await this.rollback(migration);
        throw error;
      }
    }
  }

  private async executeMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(
        tx => {
          for (const sql of migration.up) {
            tx.executeSql(sql);
          }
          tx.executeSql(
            `INSERT INTO ${MIGRATIONS_TABLE} (version, executed_at) VALUES (?, ?)`,
            [migration.version, Date.now()]
          );
        },
        error => reject(error),
        () => {
          this.setVersion(migration.version)
            .then(resolve)
            .catch(reject);
        }
      );
    });
  }

  private async rollback(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(
        tx => {
          for (const sql of migration.down) {
            tx.executeSql(sql);
          }
          tx.executeSql(
            `DELETE FROM ${MIGRATIONS_TABLE} WHERE version = ?`,
            [migration.version]
          );
        },
        error => reject(error),
        () => {
          this.setVersion(migration.version - 1)
            .then(resolve)
            .catch(reject);
        }
      );
    });
  }
}