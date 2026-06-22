import { useState, useEffect, useCallback } from "react"
import { useAppStore } from "@/store"
import { api } from "@/api"
import type { UserAssets, Order } from "../../shared/types"
import { RARITY_COLORS, RARITY_BG, CREDIT_GRADE_COLORS, CREDIT_GRADE_BG } from "../../shared/types"
import { Coins, Package, Clock, X, Shield, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  PENDING: { text: "等待中", color: "text-gold" },
  MATCHED: { text: "已撮合", color: "text-up" },
  SETTLING: { text: "结算中", color: "text-up" },
  SETTLED: { text: "已完成", color: "text-up" },
  FAILED: { text: "失败", color: "text-down" },
  CANCELLED: { text: "已撤单", color: "text-dimmed" },
}

export default function Assets() {
  const { user, refreshBalance, refreshCredit } = useAppStore()
  const [assets, setAssets] = useState<UserAssets | null>(null)
  const [depositAmount, setDepositAmount] = useState("")
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({})

  const fetchAssets = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.getAssets(user.id)
      setAssets(data)
    } catch {}
  }, [user])

  useEffect(() => {
    fetchAssets()
    const interval = setInterval(fetchAssets, 5000)
    return () => clearInterval(interval)
  }, [fetchAssets])

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldowns((prev) => {
        const next = { ...prev }
        for (const [id, remaining] of Object.entries(next)) {
          if (remaining <= 1) delete next[id]
          else next[id] = remaining - 1
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleDeposit = async () => {
    if (!user || !depositAmount) return
    try {
      await api.deposit(user.id, Number(depositAmount))
      setDepositAmount("")
      refreshBalance()
      fetchAssets()
    } catch {}
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return
    try {
      const result = await api.cancelOrder(orderId, user.id)
      if (result.cooldownRemaining) {
        setCooldowns((prev) => ({ ...prev, [orderId]: result.cooldownRemaining! }))
      }
      fetchAssets()
      refreshBalance()
      refreshCredit()
    } catch {}
  }

  if (!assets) {
    return (
      <div className="flex items-center justify-center h-96 text-dimmed text-xs">
        加载中...
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <h1 className="font-display text-gold text-lg tracking-wider">MY ASSETS</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-secondary rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Coins size={18} className="text-gold" />
            <h2 className="text-sm text-white">账户余额</h2>
          </div>
          <p className="font-display text-gold text-3xl mb-4">
            {(assets.balance / 100).toFixed(0)}
            <span className="text-sm text-dimmed ml-1">G</span>
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="充值金额"
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-gold/50"
            />
            <button
              onClick={handleDeposit}
              disabled={!depositAmount}
              className="bg-gold text-primary font-bold text-xs px-4 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              充值
            </button>
          </div>
        </div>

        <div className="bg-secondary rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} style={{ color: CREDIT_GRADE_COLORS[assets.credit?.grade ?? "A"] }} />
            <h2 className="text-sm text-white">交易信用</h2>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center border-2"
              style={{
                borderColor: CREDIT_GRADE_COLORS[assets.credit?.grade ?? "A"],
                backgroundColor: CREDIT_GRADE_BG[assets.credit?.grade ?? "A"],
              }}
            >
              <span
                className="font-display text-2xl font-bold"
                style={{ color: CREDIT_GRADE_COLORS[assets.credit?.grade ?? "A"] }}
              >
                {assets.credit?.grade ?? "A"}
              </span>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-dimmed">信用分</span>
                <span className="text-white font-display">{assets.credit?.score ?? 100}</span>
              </div>
              <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${assets.credit?.score ?? 100}%`,
                    backgroundColor: CREDIT_GRADE_COLORS[assets.credit?.grade ?? "A"],
                  }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-dimmed">挂单上限</span>
                <span className="text-white">
                  {assets.credit?.activeOrderCount ?? 0} / {assets.credit?.maxActiveOrders ?? 30}
                </span>
              </div>
            </div>
          </div>
          {assets.credit?.violationCooldownUntil && assets.credit.violationCooldownUntil > Date.now() && (
            <div className="mt-3 flex items-center gap-2 text-xs text-down bg-down-dim rounded-lg px-3 py-2">
              <AlertTriangle size={14} />
              <span>违规冷却中，{Math.ceil((assets.credit!.violationCooldownUntil - Date.now()) / (60 * 60 * 1000))} 小时后解除</span>
            </div>
          )}
        </div>

        <div className="bg-secondary rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-up" />
            <h2 className="text-sm text-white">交易统计</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-dimmed">成交率</span>
              <span className="text-up">{(assets.credit?.fillRate ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-dimmed">撤单率</span>
              <span className={(assets.credit?.cancelRate ?? 0) > 30 ? "text-down" : "text-white"}>
                {(assets.credit?.cancelRate ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-dimmed">活跃挂单</span>
              <span className="text-white">{assets.credit?.activeOrderCount ?? 0} 单</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border text-[10px] text-dimmed space-y-1">
            <p>• 频繁撤单会降低信用分</p>
            <p>• 成功成交可恢复信用分</p>
            <p>• 信用分过低将限制挂单数量</p>
          </div>
        </div>
      </div>

      <div className="bg-secondary rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-gold" />
            <h2 className="text-sm text-white">持卡仓库</h2>
          </div>
          <span className="text-xs text-dimmed">共 {assets.cards.length} 张</span>
        </div>
        {assets.cards.length === 0 ? (
          <p className="text-dimmed text-xs py-8 text-center">暂无卡牌，去抽卡获取吧！</p>
        ) : (
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto">
            {assets.cards.map((uc) => (
              <div
                key={uc.id}
                className="rounded-lg border p-2 text-center transition-all hover:scale-105"
                style={{
                  borderColor: RARITY_COLORS[uc.card.rarity],
                  backgroundColor: RARITY_BG[uc.card.rarity],
                }}
              >
                <span
                  className="text-[10px] font-bold"
                  style={{ color: RARITY_COLORS[uc.card.rarity] }}
                >
                  {uc.card.rarity}
                </span>
                <p className="text-xs text-white truncate mt-0.5">{uc.card.name}</p>
                {uc.listed && (
                  <span className="text-[10px] text-down">挂单中</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-secondary rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gold" />
            <h2 className="text-sm text-white">订单管理</h2>
          </div>
          <span className="text-xs text-dimmed">{assets.orders.length} 笔</span>
        </div>
        {assets.orders.length === 0 ? (
          <p className="text-dimmed text-xs py-8 text-center">暂无订单</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {assets.orders.map((order) => {
              const statusInfo = STATUS_LABELS[order.status] || { text: order.status, color: "text-muted" }
              const now = Date.now()
              const isCoolingDown = order.status === "PENDING" && now < order.cooldownUntil
              const cooldownSec = cooldowns[order.id] ?? (isCoolingDown ? Math.ceil((order.cooldownUntil - now) / 1000) : 0)

              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 bg-card rounded-lg p-3 text-xs"
                >
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      order.type === "buy" ? "bg-up-dim text-up" : "bg-down-dim text-down"
                    }`}
                  >
                    {order.type === "buy" ? "买" : "卖"}
                  </span>
                  <span className="text-white">{order.card?.name || order.cardId}</span>
                  <span className="text-gold font-display">
                    {(order.price / 100).toFixed(0)}G
                  </span>
                  <span className="text-muted">×{order.quantity}</span>
                  <span className={`ml-auto ${statusInfo.color}`}>{statusInfo.text}</span>

                  {order.status === "PENDING" && isCoolingDown && cooldownSec > 0 && (
                    <span className="text-dimmed font-display">{cooldownSec}s</span>
                  )}

                  {order.status === "PENDING" && !isCoolingDown && cooldownSec <= 0 && (
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="p-1 rounded hover:bg-down-dim text-down transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
