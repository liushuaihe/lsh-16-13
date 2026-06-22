import { Router, type Request, type Response } from "express"
import * as trading from "../services/trading.js"
import * as assets from "../services/assets.js"

const router = Router()

router.post("/orders", (req: Request, res: Response) => {
  const { userId, type, cardId, price, quantity } = req.body
  if (!userId || !type || !cardId || !price || !quantity) {
    res.status(400).json({ error: "参数不完整" })
    return
  }
  if (type !== "buy" && type !== "sell") {
    res.status(400).json({ error: "订单类型无效" })
    return
  }
  const result = trading.createOrder(userId, type, cardId, Number(price), Number(quantity))
  if ("error" in result) {
    res.status(400).json({ error: result.error })
    return
  }
  res.json(result)
})

router.delete("/orders/:orderId", (req: Request, res: Response) => {
  const { orderId } = req.params
  const { userId } = req.body
  if (!userId) {
    res.status(400).json({ error: "缺少用户ID" })
    return
  }
  const result = trading.cancelOrder(orderId, userId)
  if (!result.success) {
    res.status(400).json(result)
    return
  }
  res.json(result)
})

router.get("/orders/book", (req: Request, res: Response) => {
  const { cardId } = req.query
  if (!cardId) {
    res.status(400).json({ error: "缺少卡牌ID" })
    return
  }
  res.json(trading.getOrderBook(cardId as string))
})

router.get("/trades/recent", (req: Request, res: Response) => {
  const { cardId } = req.query
  const limit = Number(req.query.limit) || 20
  if (!cardId) {
    res.status(400).json({ error: "缺少卡牌ID" })
    return
  }
  res.json(trading.getRecentTrades(cardId as string, limit))
})

router.get("/cards", (_req: Request, res: Response) => {
  res.json(assets.getAllCards())
})

export default router
