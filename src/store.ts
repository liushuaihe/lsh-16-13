import { create } from "zustand"
import type { User, Card, CreditInfo } from "../shared/types"
import { api } from "./api"

interface AppState {
  user: User | null
  cards: Card[]
  selectedCardId: string | null
  initialized: boolean
  creditInfo: CreditInfo | null
  login: (username: string) => Promise<void>
  fetchCards: () => Promise<void>
  selectCard: (cardId: string) => void
  refreshBalance: () => Promise<void>
  refreshCredit: () => Promise<void>
  logout: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  cards: [],
  selectedCardId: null,
  initialized: false,
  creditInfo: null,

  login: async (username: string) => {
    const user = await api.login(username)
    set({ user, initialized: true })
    localStorage.setItem("userId", user.id)
    localStorage.setItem("username", user.username)
    await get().fetchCards()
    await get().refreshCredit()
  },

  fetchCards: async () => {
    const cards = await api.getCards()
    set({ cards, selectedCardId: cards.length > 0 ? cards[0].id : null })
  },

  selectCard: (cardId: string) => set({ selectedCardId: cardId }),

  refreshBalance: async () => {
    const user = get().user
    if (!user) return
    const assets = await api.getAssets(user.id)
    set({ user: { ...user, balance: assets.balance } })
  },

  refreshCredit: async () => {
    const user = get().user
    if (!user) return
    const assets = await api.getAssets(user.id)
    set({ creditInfo: assets.credit })
    if (get().user) {
      set({ user: { ...get().user!, creditScore: assets.credit.score } })
    }
  },

  logout: () => {
    set({ user: null, initialized: false, creditInfo: null })
    localStorage.removeItem("userId")
    localStorage.removeItem("username")
  },
}))
