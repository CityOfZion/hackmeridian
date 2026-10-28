import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Durable before relay submission. Run one service against this database on a persistent volume. */
export function openTransferStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, public_key TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_transfer ON transfers(public_key) WHERE state IN ('pending', 'unknown');`);
  return {
    get(id) {
      const row = db.prepare('SELECT data FROM transfers WHERE id = ?').get(id);
      return row ? JSON.parse(row.data) : null;
    },
    active(publicKey) {
      const row = db
        .prepare("SELECT data FROM transfers WHERE public_key = ? AND state IN ('pending', 'unknown')")
        .get(publicKey);
      return row ? JSON.parse(row.data) : null;
    },
    save(record) {
      db.prepare(
        `INSERT INTO transfers (id, public_key, state, data) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET state=excluded.state, data=excluded.data`,
      ).run(record.prepared.id, record.publicKey, record.state, JSON.stringify(record));
    },
    claim(record) {
      return (
        db
          .prepare("UPDATE transfers SET state = 'pending', data = ? WHERE id = ? AND state = 'prepared'")
          .run(JSON.stringify(record), record.prepared.id).changes === 1
      );
    },
    close: () => db.close(),
  };
}
