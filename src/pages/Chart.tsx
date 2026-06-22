import { useState, useEffect, useRef, useCallback } from "react"
import { useAppStore } from "@/store"
import { api } from "@/api"
import type { TimeRange, PricePoint, VolumePoint, DepthData } from "../../shared/types"
import { RARITY_COLORS } from "../../shared/types"

export default function Chart() {
  const { cards, selectedCardId, selectCard } = useAppStore()
  const [range, setRange] = useState<TimeRange>("1d")
  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([])
  const [depthData, setDepthData] = useState<DepthData | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedCardId) return
    try {
      const [prices, volumes, depth] = await Promise.all([
        api.getPriceHistory(selectedCardId, range),
        api.getVolumeHistory(selectedCardId, range),
        api.getDepthData(selectedCardId),
      ])
      setPriceData(prices)
      setVolumeData(volumes)
      setDepthData(depth)
    } catch {}
  }, [selectedCardId, range])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const selectedCard = cards.find((c) => c.id === selectedCardId)

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-gold text-lg tracking-wider">MARKET CHART</h1>
        <div className="flex gap-2">
          {(["1h", "6h", "1d", "7d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-xs transition-all ${
                range === r
                  ? "bg-gold text-primary font-bold"
                  : "bg-card text-muted hover:text-gold"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => selectCard(card.id)}
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
        <div className="space-y-4">
          <div className="bg-secondary rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{
                  backgroundColor: `rgba(${RARITY_COLORS[selectedCard.rarity] === "#f0b90b" ? "240,185,11" : RARITY_COLORS[selectedCard.rarity] === "#c850ff" ? "200,80,255" : RARITY_COLORS[selectedCard.rarity] === "#4a9eff" ? "74,158,255" : "139,139,139"},0.15)`,
                  color: RARITY_COLORS[selectedCard.rarity],
                }}
              >
                {selectedCard.rarity}
              </span>
              <span className="text-sm">{selectedCard.name}</span>
            </div>
            <PriceChart data={priceData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-secondary rounded-xl border border-border p-4">
              <h3 className="text-xs text-muted mb-3">成交量</h3>
              <VolumeChart data={volumeData} />
            </div>

            <div className="bg-secondary rounded-xl border border-border p-4">
              <h3 className="text-xs text-muted mb-3">深度图</h3>
              {depthData ? (
                <DepthChart data={depthData} />
              ) : (
                <div className="h-40 flex items-center justify-center text-dimmed text-xs">
                  加载中...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PriceChart({ data }: { data: PricePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 20, right: 10, bottom: 25, left: 50 }

    ctx.clearRect(0, 0, w, h)

    const prices = data.map((d) => d.price)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    const range = maxP - minP || 1

    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    ctx.strokeStyle = "#2b3139"
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(w - padding.right, y)
      ctx.stroke()

      const val = maxP - (range / 4) * i
      ctx.fillStyle = "#5e6673"
      ctx.font = "10px Orbitron"
      ctx.textAlign = "right"
      ctx.fillText((val / 100).toFixed(0), padding.left - 5, y + 3)
    }

    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom)
    gradient.addColorStop(0, "rgba(240, 185, 11, 0.2)")
    gradient.addColorStop(1, "rgba(240, 185, 11, 0)")

    ctx.beginPath()
    ctx.moveTo(padding.left, h - padding.bottom)
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW
      const y = padding.top + (1 - (d.price - minP) / range) * chartH
      ctx.lineTo(x, y)
    })
    ctx.lineTo(padding.left + chartW, h - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.strokeStyle = "#f0b90b"
    ctx.lineWidth = 2
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartW
      const y = padding.top + (1 - (d.price - minP) / range) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const last = data[data.length - 1]
    const lastX = padding.left + chartW
    const lastY = padding.top + (1 - (last.price - minP) / range) * chartH
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = "#f0b90b"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(240, 185, 11, 0.3)"
    ctx.lineWidth = 2
    ctx.stroke()
  }, [data])

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-dimmed text-xs">
        暂无价格数据
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full h-52" />
}

function VolumeChart({ data }: { data: VolumePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 10, right: 10, bottom: 20, left: 40 }

    ctx.clearRect(0, 0, w, h)

    const volumes = data.map((d) => d.volume)
    const maxV = Math.max(...volumes, 1)

    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom
    const barW = Math.max(2, chartW / data.length - 2)

    data.forEach((d, i) => {
      const x = padding.left + (i / data.length) * chartW
      const barH = (d.volume / maxV) * chartH
      const y = padding.top + chartH - barH

      ctx.fillStyle = "rgba(0, 192, 135, 0.5)"
      ctx.fillRect(x, y, barW, barH)
    })
  }, [data])

  if (data.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-dimmed text-xs">
        暂无成交量数据
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full h-36" />
}

function DepthChart({ data }: { data: DepthData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 10, right: 10, bottom: 20, left: 40 }

    ctx.clearRect(0, 0, w, h)

    const allPrices = [...data.buys, ...data.sells].map((d) => d.price)
    const minP = Math.min(...allPrices)
    const maxP = Math.max(...allPrices)
    const pRange = maxP - minP || 1
    const allQty = [...data.buys, ...data.sells].map((d) => d.quantity)
    const maxQ = Math.max(...allQty, 1)

    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    const midPrice = (minP + maxP) / 2
    const midX = padding.left + ((midPrice - minP) / pRange) * chartW

    const buyGrad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom)
    buyGrad.addColorStop(0, "rgba(0, 192, 135, 0.4)")
    buyGrad.addColorStop(1, "rgba(0, 192, 135, 0)")

    ctx.beginPath()
    ctx.moveTo(midX, h - padding.bottom)
    for (const b of data.buys) {
      const x = padding.left + ((b.price - minP) / pRange) * chartW
      const barH = (b.quantity / maxQ) * chartH
      ctx.lineTo(x, h - padding.bottom - barH)
    }
    ctx.lineTo(midX, h - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = buyGrad
    ctx.fill()

    const sellGrad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom)
    sellGrad.addColorStop(0, "rgba(246, 70, 93, 0.4)")
    sellGrad.addColorStop(1, "rgba(246, 70, 93, 0)")

    ctx.beginPath()
    ctx.moveTo(midX, h - padding.bottom)
    for (const s of data.sells) {
      const x = padding.left + ((s.price - minP) / pRange) * chartW
      const barH = (s.quantity / maxQ) * chartH
      ctx.lineTo(x, h - padding.bottom - barH)
    }
    ctx.lineTo(midX, h - padding.bottom)
    ctx.closePath()
    ctx.fillStyle = sellGrad
    ctx.fill()
  }, [data])

  if (data.buys.length === 0 && data.sells.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-dimmed text-xs">
        暂无深度数据
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full h-36" />
}
