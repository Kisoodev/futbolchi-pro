/**
 * MVP persistence: one JSON document, held in memory and flushed to disk.
 *
 * `transaction` runs synchronously, so on Node's single thread no other
 * request can interleave inside it — this is what makes the payment checks
 * atomic in the MVP.
 * TODO(db): move to Postgres/SQLite with UNIQUE constraints on
 * processed_events.key, entitlements.payment_id and receipts.payment_id,
 * and run grant logic inside a DB transaction.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { emptyDb, type DbShape } from '../domain';

export class JsonStore {
  private db: DbShape;

  /** filePath = null keeps everything in memory (tests). */
  constructor(private readonly filePath: string | null = null) {
    this.db = emptyDb();
    if (filePath && existsSync(filePath)) {
      this.db = { ...emptyDb(), ...(JSON.parse(readFileSync(filePath, 'utf8')) as Partial<DbShape>) };
    }
  }

  read<T>(fn: (db: Readonly<DbShape>) => T): T {
    return fn(this.db);
  }

  /** Synchronous read-modify-write. Must not await inside fn. */
  transaction<T>(fn: (db: DbShape) => T): T {
    const result = fn(this.db);
    this.flush();
    return result;
  }

  private flush(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db));
    renameSync(tmp, this.filePath);
  }
}
