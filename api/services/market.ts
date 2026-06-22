import { query } from "../db.js"
import type { PricePoint, VolumePoint, DepthData, TimeRange } from "../../shared/types.js"

function getRangeMs(range: TimeRange): number {
  switch (range) {
    case "1h": return 3600000
    case "6h": return 21600000
    case "1d": return 86400000
    case "7d": return 604800000
  }
}

export function getPriceHistory(cardId: string, range: TimeRange): PricePoint[] {
  const since = Date.now() - getRangeMs(range)
  return query<PricePoint>(
    "SELECT createdAt as timestamp, price FROM trades WHERE cardId = ? AND createdAt >= ? ORDER BY createdAt ASC",
    [cardId, since]
  )
}

export function getVolumeHistory(cardId: string, range: TimeRange): VolumePoint[] {
  const since = Date.now() - getRangeMs(range)
  const trades = query<{ createdAt: number; quantity: number }>(
    "SELECT createdAt, quantity FROM trades WHERE cardId = ? AND createdAt >= ? ORDER BY createdAt ASC",
    [cardId, since]
  )

  const bucketMs = range === "1h" ? 300000 : range === "6h" ? 1800000 : 3600000
  const buckets = new Map<number, number>()

  for (const t of trades) {
    const bucket = Math.floor(t.createdAt / bucketMs) * bucketMs
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + t.quantity)
  }

  return Array.from(buckets.entries())
    .map(([timestamp, volume]) => ({ timestamp, volume }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function getDepthData(cardId: string): DepthData {
  const buys = query<{ price: number; quantity: number }>(
    `SELECT price, SUM(remainingQuantity) as quantity FROM orders
     WHERE cardId = ? AND type = 'buy' AND status = 'PENDING'
     GROUP BY price ORDER BY price DESC`,
    [cardId]
  )
  const sells = query<{ price: number; quantity: number }>(
    `SELECT price, SUM(remainingQuantity) as quantity FROM orders
     WHERE cardId = ? AND type = 'sell' AND status = 'PENDING'
     GROUP BY price ORDER BY price ASC`,
    [cardId]
  )
  return { buys, sells }
}
