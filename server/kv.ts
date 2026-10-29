/**
 * A tiny key-value store for family links and snapshots.
 *
 * - With DATABASE_URL (Neon or any Postgres): one table, cf_kv.
 * - Without it: a JSON file in DATA_DIR (fine on your own computer; wiped on hosts without a disk).
 *
 * Every value is sealed with the server key before it's stored, so the database only ever holds
 * ciphertext: whoever can read the database still can't read names or grades.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decrypt, encrypt } from './session.ts'

export interface Kv {
  get<T>(ns: string, key: string): Promise<T | null>
  set(ns: string, key: string, value: unknown): Promise<void>
  del(ns: string, key: string): Promise<void>
  readonly kind: 'postgres' | 'file' | 'memory'
}

const seal = (v: unknown) => encrypt(JSON.stringify(v))
const unseal = <T>(s: string): T | null => {
  try {
    return JSON.parse(decrypt(s)) as T
  } catch {
    return null // sealed with an old key: treat as missing
  }
}

export function memoryKv(file?: string): Kv {
  let rows: Record<string, string> = {}
  if (file && existsSync(file)) {
    try {
      rows = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      rows = {}
    }
  }
  const save = () => {
    if (!file) return
    writeFileSync(`${file}.tmp`, JSON.stringify(rows), { mode: 0o600 })
    renameSync(`${file}.tmp`, file)
  }
  return {
    kind: file ? 'file' : 'memory',
    async get<T>(ns: string, key: string) {
      const v = rows[`${ns}:${key}`]
      return v == null ? null : unseal<T>(v)
    },
    async set(ns, key, value) {
      rows[`${ns}:${key}`] = seal(value)
      save()
    },
    async del(ns, key) {
      delete rows[`${ns}:${key}`]
      save()
    },
  }
}

export async function postgresKv(url: string): Promise<Kv> {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url, max: 4, idleTimeoutMillis: 30_000, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true } })
  await pool.query('create table if not exists cf_kv (ns text not null, k text not null, v text not null, updated_at timestamptz not null default now(), primary key (ns, k))')
  return {
    kind: 'postgres',
    async get<T>(ns: string, key: string) {
      const r = await pool.query<{ v: string }>('select v from cf_kv where ns = $1 and k = $2', [ns, key])
      return r.rows[0] ? unseal<T>(r.rows[0].v) : null
    },
    async set(ns, key, value) {
      await pool.query('insert into cf_kv (ns, k, v) values ($1, $2, $3) on conflict (ns, k) do update set v = excluded.v, updated_at = now()', [ns, key, seal(value)])
    },
    async del(ns, key) {
      await pool.query('delete from cf_kv where ns = $1 and k = $2', [ns, key])
    },
  }
}

export async function openKv(dataDir: string): Promise<Kv> {
  if (process.env.DATABASE_URL) return postgresKv(process.env.DATABASE_URL)
  if (process.env.SESSION_STORE === 'cookie') {
    console.warn('Family sharing: no DATABASE_URL set, so links are kept in memory and lost on restart.')
    return memoryKv()
  }
  mkdirSync(dataDir, { recursive: true })
  return memoryKv(join(dataDir, 'family.json'))
}
