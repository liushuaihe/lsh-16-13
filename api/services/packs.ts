import { v4 as uuid } from "uuid"
import { query, run, transaction } from "../db.js"
import type { Card, CardRarity, PackSeries, PityCounter, DrawResult } from "../../shared/types.js"

export const PACK_SERIES: PackSeries[] = [
  {
    id: "pack_classic",
    name: "经典卡包",
    price: 500,
    cardPool: [
      { rarity: "N", weight: 60 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 12 },
      { rarity: "SSR", weight: 3 },
    ],
    pitySR: 10,
    pitySSR: 50,
  },
  {
    id: "pack_premium",
    name: "豪华卡包",
    price: 1200,
    cardPool: [
      { rarity: "N", weight: 40 },
      { rarity: "R", weight: 30 },
      { rarity: "SR", weight: 22 },
      { rarity: "SSR", weight: 8 },
    ],
    pitySR: 8,
    pitySSR: 30,
  },
  {
    id: "pack_ultimate",
    name: "终极卡包",
    price: 3000,
    cardPool: [
      { rarity: "N", weight: 20 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 35 },
      { rarity: "SSR", weight: 20 },
    ],
    pitySR: 5,
    pitySSR: 15,
  },
]

function pickRarity(pack: PackSeries, pity: PityCounter): CardRarity {
  const roll = Math.random() * 100
  let cumulative = 0

  if (pity.ssrCount >= pack.pitySSR - 1) return "SSR"
  if (pity.srCount >= pack.pitySR - 1) return "SR"

  for (const entry of pack.cardPool) {
    cumulative += entry.weight
    if (roll < cumulative) return entry.rarity
  }
  return "N"
}

function pickCardByRarity(rarity: CardRarity): Card {
  const cards = query<Card>("SELECT * FROM cards WHERE rarity = ?", [rarity])
  if (cards.length === 0) {
    const fallback = query<Card>("SELECT * FROM cards")
    return fallback[Math.floor(Math.random() * fallback.length)]
  }
  return cards[Math.floor(Math.random() * cards.length)]
}

export function drawPack(userId: string, packId: string, count: 1 | 10): DrawResult | { error: string } {
  const pack = PACK_SERIES.find((p) => p.id === packId)
  if (!pack) return { error: "卡包不存在" }

  return transaction(() => {
    const totalCost = pack.price * count
    const users = query<{ balance: number }>("SELECT balance FROM users WHERE id = ?", [userId])
    if (users.length === 0) return { error: "用户不存在" }
    if (users[0].balance < totalCost) return { error: "余额不足" }

    run("UPDATE users SET balance = balance - ? WHERE id = ?", [totalCost, userId])

    let pity = getPityCounter(userId, packId)
    const drawnCards: Card[] = []
    let hasSROrAbove = false

    for (let i = 0; i < count; i++) {
      const rarity = pickRarity(pack, pity)
      const card = pickCardByRarity(rarity)
      drawnCards.push(card)

      const userCardId = uuid()
      run(
        "INSERT INTO user_cards (id, userId, cardId, listed, acquiredAt) VALUES (?, ?, ?, 0, ?)",
        [userCardId, userId, card.id, Date.now()]
      )

      if (rarity === "SSR") {
        pity.ssrCount = 0
        pity.srCount = 0
        hasSROrAbove = true
      } else if (rarity === "SR") {
        pity.srCount = 0
        pity.ssrCount = pity.ssrCount + 1
        hasSROrAbove = true
      } else {
        pity.srCount += 1
        pity.ssrCount += 1
      }

      run("UPDATE pity_counters SET srCount = ?, ssrCount = ? WHERE id = ?", [
        pity.srCount,
        pity.ssrCount,
        pity.id,
      ])
    }

    if (count === 10 && !hasSROrAbove) {
      const srCard = pickCardByRarity("SR")
      drawnCards[drawnCards.length - 1] = srCard
      const lastUserCard = query<{ id: string }>(
        "SELECT id FROM user_cards WHERE userId = ? ORDER BY acquiredAt DESC LIMIT 1",
        [userId]
      )
      if (lastUserCard.length > 0) {
        run("UPDATE user_cards SET cardId = ? WHERE id = ?", [srCard.id, lastUserCard[0].id])
      }
      pity.srCount = 0
      run("UPDATE pity_counters SET srCount = 0 WHERE id = ?", [pity.id])
    }

    const updatedPity = getPityCounter(userId, packId)
    return { cards: drawnCards, pityCounters: updatedPity }
  })
}

export function getPityCounter(userId: string, packId: string): PityCounter {
  const existing = query<PityCounter>(
    "SELECT * FROM pity_counters WHERE userId = ? AND packId = ?",
    [userId, packId]
  )
  if (existing.length > 0) return existing[0]

  const id = uuid()
  run("INSERT INTO pity_counters (id, userId, packId, srCount, ssrCount) VALUES (?, ?, ?, 0, 0)", [
    id,
    userId,
    packId,
  ])
  return { id, userId, packId, srCount: 0, ssrCount: 0 }
}

export function getPackSeries(): PackSeries[] {
  return PACK_SERIES
}
