import { v4 as uuid } from "uuid"
import { query, run, transaction } from "../db.js"
import type { Order, OrderType, OrderStatus, Trade } from "../../shared/types.js"
import * as credit from "./credit.js"

const COOLDOWN_MS = 60_000

export function createOrder(
  userId: string,
  type: OrderType,
  cardId: string,
  price: number,
  quantity: number
): { order: Order; trades: Trade[] } | { error: string } {
  const creditCheck = credit.canCreateOrder(userId)
  if (!creditCheck.allowed) {
    return { error: creditCheck.reason || "信用分不足，无法挂单" }
  }

  if (type === "buy") {
    const users = query<{ balance: number }>("SELECT balance FROM users WHERE id = ?", [userId])
    if (users.length === 0) return { error: "用户不存在" }
    if (users[0].balance < price * quantity) return { error: "余额不足" }
  }

  if (type === "sell") {
    const cards = query<{ id: string }>(
      "SELECT id FROM user_cards WHERE userId = ? AND cardId = ? AND listed = 0 LIMIT ?",
      [userId, cardId, quantity]
    )
    if (cards.length < quantity) return { error: "持有卡牌不足" }
  }

  return transaction(() => {
    if (type === "buy") {
      run("UPDATE users SET balance = balance - ? WHERE id = ?", [price * quantity, userId])
    }

    if (type === "sell") {
      const sellCards = query<{ id: string }>(
        "SELECT id FROM user_cards WHERE userId = ? AND cardId = ? AND listed = 0 LIMIT ?",
        [userId, cardId, quantity]
      )
      for (const c of sellCards) {
        run("UPDATE user_cards SET listed = 1 WHERE id = ?", [c.id])
      }
    }

    const now = Date.now()
    const orderId = uuid()
    run(
      "INSERT INTO orders (id, userId, type, cardId, price, quantity, remainingQuantity, status, createdAt, cooldownUntil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [orderId, userId, type, cardId, price, quantity, quantity, "PENDING", now, now + COOLDOWN_MS]
    )

    credit.recordOrderCreated(userId)

    const trades = matchOrdersInner(cardId)

    const order = query<Order>("SELECT * FROM orders WHERE id = ?", [orderId])[0]
    return { order, trades }
  })
}

function matchOrdersInner(cardId: string): Trade[] {
  const trades: Trade[] = []

  const buys = query<Order>(
    "SELECT * FROM orders WHERE cardId = ? AND type = 'buy' AND status = 'PENDING' AND remainingQuantity > 0 ORDER BY price DESC, createdAt ASC",
    [cardId]
  )
  const sells = query<Order>(
    "SELECT * FROM orders WHERE cardId = ? AND type = 'sell' AND status = 'PENDING' AND remainingQuantity > 0 ORDER BY price ASC, createdAt ASC",
    [cardId]
  )

  let bi = 0
  let si = 0

  while (bi < buys.length && si < sells.length) {
    const buyOrder = buys[bi]
    const sellOrder = sells[si]

    if (buyOrder.price < sellOrder.price) break
    if (buyOrder.remainingQuantity <= 0) { bi++; continue }
    if (sellOrder.remainingQuantity <= 0) { si++; continue }

    const matchQty = Math.min(buyOrder.remainingQuantity, sellOrder.remainingQuantity)
    const matchPrice = buyOrder.createdAt <= sellOrder.createdAt ? buyOrder.price : sellOrder.price

    const sellerCards = query<{ id: string }>(
      "SELECT id FROM user_cards WHERE userId = ? AND cardId = ? AND listed = 1 LIMIT ?",
      [sellOrder.userId, cardId, matchQty]
    )

    if (sellerCards.length < matchQty) {
      si++
      continue
    }

    for (const sc of sellerCards) {
      run("UPDATE user_cards SET userId = ?, listed = 0 WHERE id = ?", [buyOrder.userId, sc.id])
    }

    run("UPDATE users SET balance = balance + ? WHERE id = ?", [matchPrice * matchQty, sellOrder.userId])

    const buyerRefund = (buyOrder.price - matchPrice) * matchQty
    if (buyerRefund > 0) {
      run("UPDATE users SET balance = balance + ? WHERE id = ?", [buyerRefund, buyOrder.userId])
    }

    const tradeId = uuid()
    const now = Date.now()
    run(
      "INSERT INTO trades (id, buyOrderId, sellOrderId, cardId, price, quantity, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [tradeId, buyOrder.id, sellOrder.id, cardId, matchPrice, matchQty, now]
    )

    const newBuyRemaining = buyOrder.remainingQuantity - matchQty
    const newSellRemaining = sellOrder.remainingQuantity - matchQty

    const buyStatus: OrderStatus = newBuyRemaining === 0 ? "SETTLED" : "PENDING"
    const sellStatus: OrderStatus = newSellRemaining === 0 ? "SETTLED" : "PENDING"

    run("UPDATE orders SET status = ?, remainingQuantity = ? WHERE id = ?", [buyStatus, newBuyRemaining, buyOrder.id])
    run("UPDATE orders SET status = ?, remainingQuantity = ? WHERE id = ?", [sellStatus, newSellRemaining, sellOrder.id])

    credit.recordOrderFilled(buyOrder.userId, matchQty)
    credit.recordOrderFilled(sellOrder.userId, matchQty)

    trades.push({
      id: tradeId,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      cardId,
      price: matchPrice,
      quantity: matchQty,
      createdAt: now,
    })

    if (newBuyRemaining <= 0) bi++
    if (newSellRemaining <= 0) si++
  }

  return trades
}

export function cancelOrder(orderId: string, userId: string): { success: boolean; message: string; cooldownRemaining?: number; penalty?: number; newScore?: number; cooldownApplied?: boolean } {
  const orders = query<Order>("SELECT * FROM orders WHERE id = ? AND userId = ?", [orderId, userId])
  if (orders.length === 0) return { success: false, message: "订单不存在" }

  const order = orders[0]
  if (order.status !== "PENDING") return { success: false, message: "当前状态不可撤单" }

  const now = Date.now()
  if (now < order.cooldownUntil) {
    return { success: false, message: "冷却期内不可撤单", cooldownRemaining: Math.ceil((order.cooldownUntil - now) / 1000) }
  }

  return transaction(() => {
    run("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [orderId])

    if (order.type === "buy") {
      run("UPDATE users SET balance = balance + ? WHERE id = ?", [order.price * order.remainingQuantity, userId])
    }

    if (order.type === "sell") {
      run("UPDATE user_cards SET listed = 0 WHERE userId = ? AND cardId = ? AND listed = 1", [userId, order.cardId])
    }

    const creditResult = credit.recordOrderCancelled(userId)

    let message = "撤单成功"
    if (creditResult.cooldownApplied) {
      message = "撤单成功，频繁撤单已触发违规冷却（24小时）"
    } else if (creditResult.penalty > 0) {
      message = `撤单成功，扣除信用分 ${creditResult.penalty} 分`
    }

    return {
      success: true,
      message,
      penalty: creditResult.penalty,
      newScore: creditResult.newScore,
      cooldownApplied: creditResult.cooldownApplied,
    }
  })
}

export function getOrderBook(cardId: string) {
  const buys = query<Order>(
    "SELECT * FROM orders WHERE cardId = ? AND type = 'buy' AND status = 'PENDING' ORDER BY price DESC, createdAt ASC",
    [cardId]
  )
  const sells = query<Order>(
    "SELECT * FROM orders WHERE cardId = ? AND type = 'sell' AND status = 'PENDING' ORDER BY price ASC, createdAt ASC",
    [cardId]
  )
  return { buys, sells }
}

export function getRecentTrades(cardId: string, limit = 20): Trade[] {
  return query<Trade>(
    "SELECT * FROM trades WHERE cardId = ? ORDER BY createdAt DESC LIMIT ?",
    [cardId, limit]
  )
}

export function getUserOrders(userId: string): Order[] {
  return query<Order>(
    "SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC",
    [userId]
  )
}
