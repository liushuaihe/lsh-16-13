import { useState, useEffect, useCallback } from "react"
import { useAppStore } from "@/store"
import { api } from "@/api"
import type { Card, OrderBook, Trade } from "../../shared/types"
import { RARITY_COLORS, RARITY_BG, CREDIT_GRADE_COLORS } from "../../shared/types"
import { Shield, AlertTriangle } from "lucide-react"

export default function Trading() {
  const { user, cards, selectedCardId, selectCard, refreshBalance, creditInfo, refreshCredit } = useAppStore()
  const [orderBook, setOrderBook] = useState<OrderBook>({ buys: [], sells: [] })
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy")
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const selectedCard = cards.find((c) => c.id === selectedCardId)

  const fetchData = useCallback(async () => {
    if (!selectedCardId) return
    try {
      const [book, trades] = await Promise.all([
        api.getOrderBook(selectedCardId),
        api.getRecentTrades(selectedCardId),
      ])
      setOrderBook(book)
      setRecentTrades(trades)
    } catch {}
  }, [selectedCardId])

  useEffect(() => {
    fetchData()
    refreshCredit()
    const interval = setInterval(() => {
      fetchData()
      refreshCredit()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchData, refreshCredit])

  const handleSubmit = async () => {
    if (!user || !selectedCardId || !price || !quantity) return
    setSubmitting(true)
    setMessage(null)
    try {
      const result = await api.createOrder(
        user.id,
        orderType,
        selectedCardId,
        Number(price),
        Number(quantity)
      )
      if ("error" in result) {
        setMessage({ type: "error", text: result.error as string })
      } else {
        setMessage({ type: "success", text: `挂单成功！${result.trades.length > 0 ? `撮合成交 ${result.trades.length} 笔` : "等待撮合"}` })
        setPrice("")
        refreshBalance()
        fetchData()
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "操作失败" })
    } finally {
      setSubmitting(false)
    }
  }

  const maxBuyQty = selectedCard && price ? Math.floor((user?.balance ?? 0) / Number(price)) : 0

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-gold text-lg tracking-wider">TRADING HALL</h1>
        <div className="flex items-center gap-4">
          {creditInfo && (
            <div className="flex items-center gap-2 text-xs">
              <Shield size={14} style={{ color: CREDIT_GRADE_COLORS[creditInfo.grade] }} />
              <span className="text-dimmed">信用</span>
              <span
                className="font-display font-bold"
                style={{ color: CREDIT_GRADE_COLORS[creditInfo.grade] }}
              >
                {creditInfo.grade}
              </span>
              <span className="text-dimmed">
                {creditInfo.activeOrderCount}/{creditInfo.maxActiveOrders}
              </span>
            </div>
          )}
          <div className="text-xs text-dimmed">
            余额: <span className="text-gold font-display">{((user?.balance ?? 0) / 100).toFixed(0)} G</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => { selectCard(card.id); setPrice("") }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              card.id === selectedCardId
                ? "border-gold bg-gold-dim text-gold"
                : "border-border bg-card text-muted hover:border-gold/30"
            }`}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
              style={{ backgroundColor: RARITY_COLORS[card.rarity] }}
            />
            {card.name}
          </button>
        ))}
      </div>

      {selectedCard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <OrderBookPanel orderBook={orderBook} />
            <RecentTradesPanel trades={recentTrades} />
          </div>

          <div className="space-y-4">
            <div className="bg-secondary rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: RARITY_BG[selectedCard.rarity],
                    color: RARITY_COLORS[selectedCard.rarity],
                  }}
                >
                  {selectedCard.rarity}
                </span>
                <span className="text-sm font-medium">{selectedCard.name}</span>
                <span className="text-xs text-dimmed ml-auto">
                  基准价 {(selectedCard.basePrice / 100).toFixed(0)}G
                </span>
              </div>

              <div className="flex gap-1 mb-4">
                <button
                  onClick={() => setOrderType("buy")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    orderType === "buy"
                      ? "bg-up text-white glow-green"
                      : "bg-up-dim text-up"
                  }`}
                >
                  买入
                </button>
                <button
                  onClick={() => setOrderType("sell")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    orderType === "sell"
                      ? "bg-down text-white glow-red"
                      : "bg-down-dim text-down"
                  }`}
                >
                  卖出
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted">单价 (G)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="输入价格"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-gold/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">
                    数量 {orderType === "buy" && price ? `(最多 ${maxBuyQty})` : ""}
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-gold/50"
                  />
                </div>
                {price && quantity && (
                  <div className="text-xs text-muted flex justify-between">
                    <span>总计</span>
                    <span className="text-gold font-display">
                      {((Number(price) * Number(quantity)) / 100).toFixed(0)} G
                    </span>
                  </div>
                )}

                {creditInfo && creditInfo.activeOrderCount >= creditInfo.maxActiveOrders - 1 && creditInfo.maxActiveOrders > 0 && (
                  <div className="flex items-center gap-2 text-xs text-down bg-down-dim rounded-lg px-3 py-2">
                    <AlertTriangle size={14} />
                    <span>挂单即将达上限 ({creditInfo.activeOrderCount}/{creditInfo.maxActiveOrders})</span>
                  </div>
                )}

                {creditInfo && creditInfo.violationCooldownUntil > Date.now() && (
                  <div className="flex items-center gap-2 text-xs text-down bg-down-dim rounded-lg px-3 py-2">
                    <AlertTriangle size={14} />
                    <span>违规冷却中，无法挂单</span>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !price || !quantity || (creditInfo !== null && creditInfo.activeOrderCount >= creditInfo.maxActiveOrders) || (creditInfo !== null && creditInfo.violationCooldownUntil > Date.now())}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${
                    orderType === "buy"
                      ? "bg-up text-white hover:bg-up/90"
                      : "bg-down text-white hover:bg-down/90"
                  }`}
                >
                  {submitting ? "提交中..." : orderType === "buy" ? "买入" : "卖出"}
                </button>
              </div>

              {message && (
                <p
                  className={`mt-3 text-xs ${
                    message.type === "success" ? "text-up" : "text-down"
                  }`}
                >
                  {message.text}
                </p>
              )}
            </div>

            <div className="bg-secondary rounded-xl border border-border p-4">
              <h3 className="text-xs text-muted mb-2">交易规则</h3>
              <ul className="text-xs text-dimmed space-y-1">
                <li>1. 价格优先：买高卖低先成交</li>
                <li>2. 时间优先：同价先挂先成交</li>
                <li>3. 成交价取先挂单方价格</li>
                <li>4. 挂单后60秒冷却期可撤单</li>
                <li>5. 频繁撤单会降低信用分</li>
                <li>6. 信用分过低将限制挂单数量</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderBookPanel({ orderBook }: { orderBook: OrderBook }) {
  const maxQty = Math.max(
    ...orderBook.sells.map((o) => o.remainingQuantity),
    ...orderBook.buys.map((o) => o.remainingQuantity),
    1
  )

  return (
    <div className="bg-secondary rounded-xl border border-border p-4">
      <h2 className="text-xs text-muted mb-3">挂单深度</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-up">买价</span>
            <span className="text-dimmed">数量</span>
          </div>
          <div className="space-y-0.5">
            {orderBook.buys.slice(0, 10).map((order) => (
              <div
                key={order.id}
                className="relative flex justify-between items-center py-1 px-2 rounded text-xs"
              >
                <div
                  className="absolute inset-0 depth-bar-buy rounded"
                  style={{ width: `${(order.remainingQuantity / maxQty) * 100}%` }}
                />
                <span className="relative text-up font-display">
                  {(order.price / 100).toFixed(0)}
                </span>
                <span className="relative text-muted">{order.remainingQuantity}</span>
              </div>
            ))}
            {orderBook.buys.length === 0 && (
              <p className="text-dimmed text-xs py-4 text-center">暂无买单</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-down">卖价</span>
            <span className="text-dimmed">数量</span>
          </div>
          <div className="space-y-0.5">
            {orderBook.sells.slice(0, 10).map((order) => (
              <div
                key={order.id}
                className="relative flex justify-between items-center py-1 px-2 rounded text-xs"
              >
                <div
                  className="absolute inset-0 depth-bar-sell rounded"
                  style={{ width: `${(order.remainingQuantity / maxQty) * 100}%` }}
                />
                <span className="relative text-down font-display">
                  {(order.price / 100).toFixed(0)}
                </span>
                <span className="relative text-muted">{order.remainingQuantity}</span>
              </div>
            ))}
            {orderBook.sells.length === 0 && (
              <p className="text-dimmed text-xs py-4 text-center">暂无卖单</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentTradesPanel({ trades }: { trades: Trade[] }) {
  return (
    <div className="bg-secondary rounded-xl border border-border p-4">
      <h2 className="text-xs text-muted mb-3">最近成交</h2>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {trades.map((trade) => (
          <div key={trade.id} className="flex justify-between items-center py-1.5 px-2 text-xs">
            <span className="text-gold font-display">{(trade.price / 100).toFixed(0)} G</span>
            <span className="text-muted">×{trade.quantity}</span>
            <span className="text-dimmed">{new Date(trade.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
        {trades.length === 0 && (
          <p className="text-dimmed text-xs py-4 text-center">暂无成交记录</p>
        )}
      </div>
    </div>
  )
}
