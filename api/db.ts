import initSqlJs, { type Database } from "sql.js"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let db: Database

const DB_PATH = path.join(__dirname, "..", "data", "marketplace.db")

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 10000,
  createdAt INTEGER NOT NULL,
  creditScore INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS user_credit_stats (
  userId TEXT PRIMARY KEY REFERENCES users(id),
  totalOrders INTEGER NOT NULL DEFAULT 0,
  cancelledOrders INTEGER NOT NULL DEFAULT 0,
  filledOrders INTEGER NOT NULL DEFAULT 0,
  violationCooldownUntil INTEGER NOT NULL DEFAULT 0,
  lastCancelledAt INTEGER NOT NULL DEFAULT 0,
  cancelStreak INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK(rarity IN ('N','R','SR','SSR')),
  basePrice INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_cards (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  cardId TEXT NOT NULL REFERENCES cards(id),
  listed INTEGER NOT NULL DEFAULT 0,
  acquiredAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('buy','sell')),
  cardId TEXT NOT NULL REFERENCES cards(id),
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  remainingQuantity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','MATCHED','SETTLING','SETTLED','FAILED','CANCELLED')),
  createdAt INTEGER NOT NULL,
  cooldownUntil INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  buyOrderId TEXT NOT NULL REFERENCES orders(id),
  sellOrderId TEXT NOT NULL REFERENCES orders(id),
  cardId TEXT NOT NULL REFERENCES cards(id),
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pity_counters (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id),
  packId TEXT NOT NULL,
  srCount INTEGER NOT NULL DEFAULT 0,
  ssrCount INTEGER NOT NULL DEFAULT 0
);
`

const SEED_CARDS = `
INSERT OR IGNORE INTO cards (id, name, rarity, basePrice) VALUES
  ('card_001', '烈焰龙', 'SSR', 5000),
  ('card_002', '暗影刺客', 'SSR', 4500),
  ('card_003', '圣光骑士', 'SR', 2000),
  ('card_004', '冰霜法师', 'SR', 1800),
  ('card_005', '森林游侠', 'SR', 1500),
  ('card_006', '铁盾战士', 'R', 800),
  ('card_007', '风行猎手', 'R', 700),
  ('card_008', '地灵术士', 'R', 600),
  ('card_009', '见习学徒', 'N', 200),
  ('card_010', '村庄守卫', 'N', 150),
  ('card_011', '流浪商人', 'N', 100),
  ('card_012', '深渊领主', 'SSR', 6000);
`

const SEED_USERS = `
INSERT OR IGNORE INTO users (id, username, balance, createdAt, creditScore) VALUES
  ('user_001', 'TraderAlice', 50000, 0, 100),
  ('user_002', 'CardHunter', 50000, 0, 100),
  ('user_003', 'PackLover', 50000, 0, 100);
`

const SEED_CREDIT_STATS = `
INSERT OR IGNORE INTO user_credit_stats (userId, totalOrders, cancelledOrders, filledOrders, violationCooldownUntil, lastCancelledAt, cancelStreak) VALUES
  ('user_001', 0, 0, 0, 0, 0, 0),
  ('user_002', 0, 0, 0, 0, 0, 0),
  ('user_003', 0, 0, 0, 0, 0, 0);
`

function saveToFile(database: Database) {
  const data = database.export()
  const buffer = Buffer.from(data)
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, buffer)
}

export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs()

  const dir = path.dirname(DB_PATH)
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
    migrateDB(db)
  } else {
    db = new SQL.Database()
    db.run(SCHEMA)
    db.run(SEED_CARDS)
    db.run(SEED_USERS)
    db.run(SEED_CREDIT_STATS)
    saveToFile(db)
  }

  return db
}

function migrateDB(database: Database): void {
  try {
    const userCols = database.prepare("PRAGMA table_info(users)")
    const columns: string[] = []
    while (userCols.step()) {
      columns.push(userCols.getAsObject().name as string)
    }
    userCols.free()

    if (!columns.includes("creditScore")) {
      database.run("ALTER TABLE users ADD COLUMN creditScore INTEGER NOT NULL DEFAULT 100")
    }

    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_credit_stats'")
    const hasCreditTable = tables.step()
    tables.free()

    if (!hasCreditTable) {
      database.run(`
        CREATE TABLE IF NOT EXISTS user_credit_stats (
          userId TEXT PRIMARY KEY REFERENCES users(id),
          totalOrders INTEGER NOT NULL DEFAULT 0,
          cancelledOrders INTEGER NOT NULL DEFAULT 0,
          filledOrders INTEGER NOT NULL DEFAULT 0,
          violationCooldownUntil INTEGER NOT NULL DEFAULT 0,
          lastCancelledAt INTEGER NOT NULL DEFAULT 0,
          cancelStreak INTEGER NOT NULL DEFAULT 0
        )
      `)

      const users = database.prepare("SELECT id FROM users")
      const userIds: string[] = []
      while (users.step()) {
        userIds.push(users.getAsObject().id as string)
      }
      users.free()

      for (const uid of userIds) {
        database.run(
          "INSERT OR IGNORE INTO user_credit_stats (userId, totalOrders, cancelledOrders, filledOrders, violationCooldownUntil, lastCancelledAt, cancelStreak) VALUES (?, 0, 0, 0, 0, 0, 0)",
          [uid]
        )
      }
    }

    const existingUsers = database.prepare("SELECT id FROM users")
    const allUserIds: string[] = []
    while (existingUsers.step()) {
      allUserIds.push(existingUsers.getAsObject().id as string)
    }
    existingUsers.free()

    for (const uid of allUserIds) {
      database.run(
        "INSERT OR IGNORE INTO user_credit_stats (userId, totalOrders, cancelledOrders, filledOrders, violationCooldownUntil, lastCancelledAt, cancelStreak) VALUES (?, 0, 0, 0, 0, 0, 0)",
        [uid]
      )
    }

    saveToFile(database)
  } catch (e) {
    console.error("Migration error:", e)
  }
}

export function getDB(): Database {
  if (!db) throw new Error("Database not initialized")
  return db
}

export function persist(): void {
  if (db) saveToFile(db)
}

export function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const database = getDB()
  const stmt = database.prepare(sql)
  if (params) stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return results
}

export function run(sql: string, params?: unknown[]): void {
  const database = getDB()
  database.run(sql, params)
}

export function transaction<T>(fn: () => T): T {
  const database = getDB()
  database.run("BEGIN TRANSACTION")
  try {
    const result = fn()
    database.run("COMMIT")
    persist()
    return result
  } catch (err) {
    try { database.run("ROLLBACK") } catch {}
    console.error("Transaction failed:", err)
    throw err
  }
}
