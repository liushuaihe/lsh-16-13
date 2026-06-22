import { v4 as uuid } from "uuid"
import { query, run } from "../db.js"
import type { User, UserCard, Card, Order } from "../../shared/types.js"
import * as credit from "./credit.js"

export function getUserAssets(userId: string) {
  const users = query<User>("SELECT * FROM users WHERE id = ?", [userId])
  if (users.length === 0) return null

  const userCards = query<UserCard & { cardName: string; cardRarity: string; cardBasePrice: number; cardId: string }>(
    `SELECT uc.*, c.name as cardName, c.rarity as cardRarity, c.basePrice as cardBasePrice, c.id as cardId
     FROM user_cards uc JOIN cards c ON uc.cardId = c.id
     WHERE uc.userId = ?
     ORDER BY uc.acquiredAt DESC`,
    [userId]
  )

  const orders = query<Order & { cardName: string; cardRarity: string }>(
    `SELECT o.*, c.name as cardName, c.rarity as cardRarity
     FROM orders o JOIN cards c ON o.cardId = c.id
     WHERE o.userId = ?
     ORDER BY o.createdAt DESC`,
    [userId]
  )

  const creditInfo = credit.getCreditInfo(userId)

  return {
    balance: users[0].balance,
    cards: userCards.map((uc) => ({
      id: uc.id,
      userId: uc.userId,
      cardId: uc.cardId,
      listed: Boolean(uc.listed),
      acquiredAt: uc.acquiredAt,
      card: {
        id: uc.cardId,
        name: uc.cardName,
        rarity: uc.cardRarity as Card["rarity"],
        basePrice: uc.cardBasePrice,
      },
    })),
    orders: orders.map((o) => ({
      ...o,
      listed: undefined,
      card: {
        id: o.cardId,
        name: o.cardName,
        rarity: o.cardRarity as Card["rarity"],
        basePrice: 0,
      },
    })),
    credit: creditInfo,
  }
}

export function deposit(userId: string, amount: number) {
  run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId])
  const users = query<User>("SELECT balance FROM users WHERE id = ?", [userId])
  return { balance: users[0]?.balance ?? 0 }
}

export function loginOrCreate(username: string): User {
  const existing = query<User>("SELECT * FROM users WHERE username = ?", [username])
  if (existing.length > 0) return existing[0]

  const id = uuid()
  const now = Date.now()
  run("INSERT INTO users (id, username, balance, createdAt, creditScore) VALUES (?, ?, 10000, ?, 100)", [
    id,
    username,
    now,
  ])
  run(
    "INSERT INTO user_credit_stats (userId, totalOrders, cancelledOrders, filledOrders, violationCooldownUntil, lastCancelledAt, cancelStreak) VALUES (?, 0, 0, 0, 0, 0, 0)",
    [id]
  )
  return query<User>("SELECT * FROM users WHERE id = ?", [id])[0]
}

export function getAllCards(): Card[] {
  return query<Card>("SELECT * FROM cards")
}
