export type OrderStatus = "PENDING" | "MATCHED" | "SETTLING" | "SETTLED" | "FAILED" | "CANCELLED"
export type OrderType = "buy" | "sell"
export type CardRarity = "N" | "R" | "SR" | "SSR"
export type TimeRange = "1h" | "6h" | "1d" | "7d"

export interface Card {
  id: string
  name: string
  rarity: CardRarity
  basePrice: number
}

export type CreditGrade = "S" | "A" | "B" | "C" | "D"

export interface User {
  id: string
  username: string
  balance: number
  createdAt: number
  creditScore: number
}

export interface UserCreditStats {
  userId: string
  creditScore: number
  totalOrders: number
  cancelledOrders: number
  filledOrders: number
  violationCooldownUntil: number
  lastCancelledAt: number
  cancelStreak: number
}

export interface CreditInfo {
  score: number
  grade: CreditGrade
  maxActiveOrders: number
  activeOrderCount: number
  cancelRate: number
  fillRate: number
  violationCooldownUntil: number
}

export interface UserCard {
  id: string
  userId: string
  cardId: string
  listed: boolean
  acquiredAt: number
}

export interface Order {
  id: string
  userId: string
  type: OrderType
  cardId: string
  price: number
  quantity: number
  remainingQuantity: number
  status: OrderStatus
  createdAt: number
  cooldownUntil: number
}

export interface Trade {
  id: string
  buyOrderId: string
  sellOrderId: string
  cardId: string
  price: number
  quantity: number
  createdAt: number
}

export interface PackSeries {
  id: string
  name: string
  price: number
  cardPool: { rarity: CardRarity; weight: number }[]
  pitySR: number
  pitySSR: number
}

export interface PityCounter {
  id: string
  userId: string
  packId: string
  srCount: number
  ssrCount: number
}

export interface DrawResult {
  cards: Card[]
  pityCounters: PityCounter
}

export interface OrderBook {
  buys: Order[]
  sells: Order[]
}

export interface PricePoint {
  timestamp: number
  price: number
}

export interface VolumePoint {
  timestamp: number
  volume: number
}

export interface DepthData {
  buys: { price: number; quantity: number }[]
  sells: { price: number; quantity: number }[]
}

export interface UserAssets {
  balance: number
  cards: (UserCard & { card: Card })[]
  orders: (Order & { card: Card })[]
  credit: CreditInfo
}

export const RARITY_COLORS: Record<CardRarity, string> = {
  N: "#8b8b8b",
  R: "#4a9eff",
  SR: "#c850ff",
  SSR: "#f0b90b",
}

export const RARITY_BG: Record<CardRarity, string> = {
  N: "rgba(139,139,139,0.15)",
  R: "rgba(74,158,255,0.15)",
  SR: "rgba(200,80,255,0.15)",
  SSR: "rgba(240,185,11,0.15)",
}

export const CREDIT_GRADE_COLORS: Record<CreditGrade, string> = {
  S: "#f0b90b",
  A: "#4a9eff",
  B: "#8b8b8b",
  C: "#ff8c00",
  D: "#ff4757",
}

export const CREDIT_GRADE_BG: Record<CreditGrade, string> = {
  S: "rgba(240,185,11,0.15)",
  A: "rgba(74,158,255,0.15)",
  B: "rgba(139,139,139,0.15)",
  C: "rgba(255,140,0,0.15)",
  D: "rgba(255,71,87,0.15)",
}
