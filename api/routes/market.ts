import { Router, type Request, type Response } from "express"
import * as market from "../services/market.js"
import type { TimeRange } from "../../shared/types.js"

const router = Router()

router.get("/price", (req: Request, res: Response) => {
  const { cardId, range } = req.query
  if (!cardId) {
    res.status(400).json({ error: "缺少卡牌ID" })
    return
  }
  const r = (["1h", "6h", "1d", "7d"].includes(range as string) ? range : "1d") as TimeRange
  res.json(market.getPriceHistory(cardId as string, r))
})

router.get("/volume", (req: Request, res: Response) => {
  const { cardId, range } = req.query
  if (!cardId) {
    res.status(400).json({ error: "缺少卡牌ID" })
    return
  }
  const r = (["1h", "6h", "1d", "7d"].includes(range as string) ? range : "1d") as TimeRange
  res.json(market.getVolumeHistory(cardId as string, r))
})

router.get("/depth", (req: Request, res: Response) => {
  const { cardId } = req.query
  if (!cardId) {
    res.status(400).json({ error: "缺少卡牌ID" })
    return
  }
  res.json(market.getDepthData(cardId as string))
})

export default router
