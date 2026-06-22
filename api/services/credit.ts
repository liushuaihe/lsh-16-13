import { query, run } from "../db.js"
import type { CreditGrade, CreditInfo, UserCreditStats } from "../../shared/types.js"

const CANCEL_STREAK_WINDOW_MS = 24 * 60 * 60 * 1000
const VIOLATION_COOLDOWN_MS = 24 * 60 * 60 * 1000
const BASE_CANCEL_PENALTY = 2
const STREAK_2_PENALTY = 5
const STREAK_3PLUS_PENALTY = 10
const FILL_BONUS = 1
const MAX_SCORE = 100
const MIN_SCORE = 0

const GRADE_CONFIG: Record<CreditGrade, { minScore: number; maxActiveOrders: number; color: string }> = {
  S: { minScore: 90, maxActiveOrders: 50, color: "#f0b90b" },
  A: { minScore: 75, maxActiveOrders: 30, color: "#4a9eff" },
  B: { minScore: 60, maxActiveOrders: 15, color: "#8b8b8b" },
  C: { minScore: 40, maxActiveOrders: 5, color: "#ff8c00" },
  D: { minScore: 0, maxActiveOrders: 0, color: "#ff4757" },
}

export function getCreditGrade(score: number): CreditGrade {
  if (score >= GRADE_CONFIG.S.minScore) return "S"
  if (score >= GRADE_CONFIG.A.minScore) return "A"
  if (score >= GRADE_CONFIG.B.minScore) return "B"
  if (score >= GRADE_CONFIG.C.minScore) return "C"
  return "D"
}

export function getMaxActiveOrders(grade: CreditGrade): number {
  return GRADE_CONFIG[grade].maxActiveOrders
}

export function getGradeColor(grade: CreditGrade): string {
  return GRADE_CONFIG[grade].color
}

function ensureCreditStats(userId: string): void {
  const existing = query("SELECT userId FROM user_credit_stats WHERE userId = ?", [userId])
  if (existing.length === 0) {
    run(
      "INSERT INTO user_credit_stats (userId, totalOrders, cancelledOrders, filledOrders, violationCooldownUntil, lastCancelledAt, cancelStreak) VALUES (?, 0, 0, 0, 0, 0, 0)",
      [userId]
    )
  }
}

export function getCreditStats(userId: string): UserCreditStats {
  ensureCreditStats(userId)
  const stats = query<UserCreditStats>(
    "SELECT * FROM user_credit_stats WHERE userId = ?",
    [userId]
  )
  const users = query<{ creditScore: number }>("SELECT creditScore FROM users WHERE id = ?", [userId])

  return {
    ...stats[0],
    creditScore: users[0]?.creditScore ?? MAX_SCORE,
  }
}

export function getCreditInfo(userId: string): CreditInfo {
  const stats = getCreditStats(userId)
  const grade = getCreditGrade(stats.creditScore)
  const maxActiveOrders = getMaxActiveOrders(grade)

  const activeOrders = query<{ count: number }>(
    "SELECT COUNT(*) as count FROM orders WHERE userId = ? AND status = 'PENDING' AND remainingQuantity > 0",
    [userId]
  )
  const activeOrderCount = activeOrders[0]?.count ?? 0

  const cancelRate = stats.totalOrders > 0 ? (stats.cancelledOrders / stats.totalOrders) * 100 : 0
  const fillRate = stats.totalOrders > 0 ? (stats.filledOrders / stats.totalOrders) * 100 : 0

  return {
    score: stats.creditScore,
    grade,
    maxActiveOrders,
    activeOrderCount,
    cancelRate: Math.round(cancelRate * 100) / 100,
    fillRate: Math.round(fillRate * 100) / 100,
    violationCooldownUntil: stats.violationCooldownUntil,
  }
}

export function canCreateOrder(userId: string): { allowed: boolean; reason?: string } {
  const info = getCreditInfo(userId)

  if (info.score <= MIN_SCORE) {
    return { allowed: false, reason: "信用分过低，无法挂单" }
  }

  if (info.violationCooldownUntil > Date.now()) {
    const hours = Math.ceil((info.violationCooldownUntil - Date.now()) / (60 * 60 * 1000))
    return { allowed: false, reason: `违规冷却中，剩余 ${hours} 小时` }
  }

  if (info.activeOrderCount >= info.maxActiveOrders) {
    return { allowed: false, reason: `活跃挂单已达上限 (${info.maxActiveOrders} 单)` }
  }

  return { allowed: true }
}

export function recordOrderCreated(userId: string): void {
  ensureCreditStats(userId)
  run(
    "UPDATE user_credit_stats SET totalOrders = totalOrders + 1 WHERE userId = ?",
    [userId]
  )
}

export function recordOrderCancelled(userId: string): { newScore: number; penalty: number; cooldownApplied: boolean } {
  ensureCreditStats(userId)
  const now = Date.now()
  const stats = getCreditStats(userId)

  const withinWindow = stats.lastCancelledAt > 0 && (now - stats.lastCancelledAt) < CANCEL_STREAK_WINDOW_MS
  const newStreak = withinWindow ? stats.cancelStreak + 1 : 1

  let penalty = BASE_CANCEL_PENALTY
  let cooldownApplied = false

  if (newStreak >= 3) {
    penalty = STREAK_3PLUS_PENALTY
    cooldownApplied = true
  } else if (newStreak === 2) {
    penalty = STREAK_2_PENALTY
  }

  const newScore = Math.max(MIN_SCORE, stats.creditScore - penalty)
  const newCooldown = cooldownApplied ? now + VIOLATION_COOLDOWN_MS : stats.violationCooldownUntil

  run("UPDATE users SET creditScore = ? WHERE id = ?", [newScore, userId])
  run(
    `UPDATE user_credit_stats 
     SET cancelledOrders = cancelledOrders + 1, 
         lastCancelledAt = ?, 
         cancelStreak = ?,
         violationCooldownUntil = ?
     WHERE userId = ?`,
    [now, newStreak, newCooldown, userId]
  )

  return { newScore, penalty, cooldownApplied }
}

export function recordOrderFilled(userId: string, quantity: number = 1): { newScore: number; bonus: number } {
  ensureCreditStats(userId)
  const stats = getCreditStats(userId)

  const bonus = FILL_BONUS * quantity
  const newScore = Math.min(MAX_SCORE, stats.creditScore + bonus)

  run("UPDATE users SET creditScore = ? WHERE id = ?", [newScore, userId])
  run(
    "UPDATE user_credit_stats SET filledOrders = filledOrders + ? WHERE userId = ?",
    [quantity, userId]
  )

  return { newScore, bonus }
}

export function isInViolationCooldown(userId: string): boolean {
  const stats = getCreditStats(userId)
  return stats.violationCooldownUntil > Date.now()
}
