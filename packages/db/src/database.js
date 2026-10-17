import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

/**
 * Checks if core tables exist and executes migrations if not yet initialized.
 * @param {Database} db
 */
export function ensureDatabaseInitialized(db) {
  try {
    const row = db.queryOne("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='merchants'");
    if (!row || Number(row.count) === 0) {
      return runMigrations(db);
    }
  } catch {
    return runMigrations(db);
  }
}

/**
 * Universal Database Client for COUPI PG.
 * Uses native node:sqlite for high-performance, embedded zero-dependency local operation
 * with full transactional ACID guarantees.
 */
export class Database {
  /**
   * @param {{ dbPath?: string, inMemory?: boolean, autoMigrate?: boolean }} [options={}]
   */
  constructor(options = {}) {
    if (options.inMemory) {
      this.db = new DatabaseSync(':memory:');
    } else {
      let dbPath;
      if (options.dbPath) {
        dbPath = path.isAbsolute(options.dbPath)
          ? options.dbPath
          : path.resolve(process.cwd(), options.dbPath);
      } else if (process.env.SQLITE_DB_PATH) {
        dbPath = path.isAbsolute(process.env.SQLITE_DB_PATH)
          ? process.env.SQLITE_DB_PATH
          : path.resolve(repoRoot, process.env.SQLITE_DB_PATH);
      } else {
        dbPath = path.resolve(repoRoot, 'data/coupi_pg.sqlite');
      }
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
    }

    // Enable foreign keys, busy timeout, and WAL mode for maximum concurrency and integrity
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
    } catch {}

    // Auto-initialize SQLite on first boot if core tables do not exist
    if (!options.inMemory && options.autoMigrate !== false) {
      ensureDatabaseInitialized(this);
    }
  }

  /**
   * Normalizes parameter markers from PostgreSQL style ($1, $2) to SQLite style (?, ?).
   * @param {string} sql
   * @returns {string}
   */
  normalizeSql(sql) {
    return sql.replace(/\$\d+/g, '?');
  }

  /**
   * Executes a statement (INSERT, UPDATE, DELETE, DDL).
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {{ changes: number, lastInsertRowid: number | bigint }}
   */
  execute(sql, params = []) {
    const normalized = this.normalizeSql(sql);
    const stmt = this.db.prepare(normalized);
    return stmt.run(...params);
  }

  run(sql, params = []) {
    return this.execute(sql, params);
  }

  /**
   * Queries multiple rows.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {any[]}
   */
  query(sql, params = []) {
    const normalized = this.normalizeSql(sql);
    const stmt = this.db.prepare(normalized);
    return stmt.all(...params);
  }

  /**
   * Queries a single row.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {any | null}
   */
  queryOne(sql, params = []) {
    const normalized = this.normalizeSql(sql);
    const stmt = this.db.prepare(normalized);
    const res = stmt.get(...params);
    return res !== undefined ? res : null;
  }

  /**
   * Executes a batch of DDL or SQL statements.
   * @param {string} sql
   */
  exec(sql) {
    this.db.exec(sql);
  }

  /**
   * Executes a callback within an ACID database transaction.
   * Automatically rolls back on exception.
   * @template T
   * @param {() => T} callback
   * @returns {T}
   */
  transaction(callback) {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback error if already rolled back
      }
      throw err;
    }
  }

  /**
   * Closes the database connection.
   */
  close() {
    this.db.close();
  }
}

let defaultDbInstance = null;

/**
 * Returns the singleton database instance.
 * @param {{ dbPath?: string, inMemory?: boolean }} [options={}]
 * @returns {Database}
 */
export function getDatabase(options = {}) {
  if (!defaultDbInstance) {
    defaultDbInstance = new Database(options);
    ensureDatabaseInitialized(defaultDbInstance);
  }
  return defaultDbInstance;
}
