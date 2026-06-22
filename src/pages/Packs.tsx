import { useState, useEffect } from "react"
import { useAppStore } from "@/store"
import { api } from "@/api"
import type { PackSeries, DrawResult, Card, PityCounter } from "../../shared/types"
import { RARITY_COLORS, RARITY_BG } from "../../shared/types"
import { motion, AnimatePresence } from "framer-motion"

const PACK_IMAGES: Record<string, string> = {
  pack_classic: "https://trae-api-cn.mchont.guru/api/ide/v1/text_to_image?prompt=fantasy%20card%20pack%20mystical%20blue%20glow%20dark%20background&image_size=landscape_4_3",
  pack_premium: "https://trae-api-cn.mchont.guru/api/ide/v1/text_to_image?prompt=premium%20card%20pack%20purple%20golden%20aura%20dark%20background&image_size=landscape_4_3",
  pack_ultimate: "https://trae-api-cn.mchont.guru/api/ide/v1/text_to_image?prompt=ultimate%20legendary%20card%20pack%20fire%20and%20gold%20dark%20background&image_size=landscape_4_3",
}

export default function Packs() {
  const { user, refreshBalance } = useAppStore()
  const [packs, setPacks] = useState<PackSeries[]>([])
  const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
  const [pityInfo, setPityInfo] = useState<PityCounter | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    api.getPackSeries().then(setPacks)
  }, [])

  useEffect(() => {
    if (user && selectedPack) {
      api.getPity(user.id, selectedPack).then(setPityInfo)
    }
  }, [user, selectedPack])

  const handleDraw = async (count: 1 | 10) => {
    if (!user || !selectedPack) return
    const pack = packs.find((p) => p.id === selectedPack)
    if (!pack) return

    setDrawing(true)
    setShowResults(false)
    setMessage(null)

    try {
      const result = await api.drawPack(user.id, selectedPack, count)
      if ("error" in result) {
        setMessage({ type: "error", text: String(result.error) })
      } else {
        setDrawResult(result)
        setPityInfo(result.pityCounters)
        refreshBalance()
        setTimeout(() => setShowResults(true), 800)
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "抽卡失败" })
    } finally {
      setDrawing(false)
    }
  }

  const currentPack = packs.find((p) => p.id === selectedPack)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-gold text-lg tracking-wider">CARD PACKS</h1>
        <div className="text-xs text-dimmed">
          余额: <span className="text-gold font-display">{((user?.balance ?? 0) / 100).toFixed(0)} G</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((pack) => (
          <button
            key={pack.id}
            onClick={() => { setSelectedPack(pack.id); setDrawResult(null); setShowResults(false) }}
            className={`relative overflow-hidden rounded-xl border transition-all text-left ${
              pack.id === selectedPack
                ? "border-gold glow-gold"
                : "border-border hover:border-gold/30"
            }`}
          >
            <img
              src={PACK_IMAGES[pack.id]}
              alt={pack.name}
              className="w-full h-32 object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-gold text-sm">{pack.name}</h3>
              <p className="text-gold font-display text-lg mt-1">
                {(pack.price / 100).toFixed(0)} <span className="text-xs text-dimmed">G</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {currentPack && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-secondary rounded-xl border border-border p-5 space-y-4">
            <h2 className="text-sm text-white font-medium">{currentPack.name} - 概率公示</h2>
            <div className="space-y-2">
              {currentPack.cardPool.map((entry) => (
                <div key={entry.rarity} className="flex items-center gap-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor: RARITY_BG[entry.rarity as keyof typeof RARITY_BG],
                      color: RARITY_COLORS[entry.rarity as keyof typeof RARITY_COLORS],
                    }}
                  >
                    {entry.rarity}
                  </span>
                  <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${entry.weight}%`,
                        backgroundColor: RARITY_COLORS[entry.rarity as keyof typeof RARITY_COLORS],
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted w-12 text-right">{entry.weight}%</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted">
                SR 保底: 每 <span className="text-up">{currentPack.pitySR}</span> 抽必出
              </p>
              <p className="text-xs text-muted">
                SSR 保底: 每 <span className="text-gold">{currentPack.pitySSR}</span> 抽必出
              </p>
              <p className="text-xs text-dimmed">十连抽至少获得 1 张 SR 或以上卡牌</p>
            </div>

            {pityInfo && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs text-white">当前保底进度</p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-up">SR</span>
                      <span className="text-dimmed">{pityInfo.srCount}/{currentPack.pitySR}</span>
                    </div>
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div
                        className="h-full bg-up rounded-full transition-all"
                        style={{ width: `${(pityInfo.srCount / currentPack.pitySR) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gold">SSR</span>
                      <span className="text-dimmed">{pityInfo.ssrCount}/{currentPack.pitySSR}</span>
                    </div>
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full transition-all"
                        style={{ width: `${(pityInfo.ssrCount / currentPack.pitySSR) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleDraw(1)}
                disabled={drawing || (user?.balance ?? 0) < currentPack.price}
                className="flex-1 bg-card border border-border rounded-lg py-2.5 text-sm text-gold hover:border-gold/30 transition-colors disabled:opacity-50"
              >
                单抽 ({(currentPack.price / 100).toFixed(0)}G)
              </button>
              <button
                onClick={() => handleDraw(10)}
                disabled={drawing || (user?.balance ?? 0) < currentPack.price * 10}
                className="flex-1 bg-gold text-primary font-bold rounded-lg py-2.5 text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                十连 ({((currentPack.price * 10) / 100).toFixed(0)}G)
              </button>
            </div>

            {message && (
              <p className={`text-xs ${message.type === "success" ? "text-up" : "text-down"}`}>
                {message.text}
              </p>
            )}
          </div>

          <div className="bg-secondary rounded-xl border border-border p-5">
            <h2 className="text-sm text-white font-medium mb-4">抽卡结果</h2>
            {drawing && (
              <div className="flex items-center justify-center h-48">
                <div className="text-gold font-display text-lg animate-pulse">DRAWING...</div>
              </div>
            )}
            {showResults && drawResult && (
              <div className="grid grid-cols-5 gap-2">
                <AnimatePresence>
                  {drawResult.cards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
                      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      className="relative rounded-lg border p-2 text-center"
                      style={{
                        borderColor: RARITY_COLORS[card.rarity],
                        backgroundColor: RARITY_BG[card.rarity],
                      }}
                    >
                      {card.rarity === "SSR" && (
                        <div className="absolute inset-0 animate-shimmer rounded-lg" />
                      )}
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: RARITY_COLORS[card.rarity] }}
                      >
                        {card.rarity}
                      </span>
                      <p className="text-xs text-white mt-1 truncate">{card.name}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            {!drawing && !showResults && (
              <div className="flex items-center justify-center h-48 text-dimmed text-xs">
                选择卡包开始抽卡
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
