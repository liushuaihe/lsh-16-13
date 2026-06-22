import { Router, type Request, type Response } from "express"
import * as packs from "../services/packs.js"

const router = Router()

router.get("/", (_req: Request, res: Response) => {
  res.json(packs.getPackSeries())
})

router.post("/:packId/draw", (req: Request, res: Response) => {
  const { packId } = req.params
  const { userId, count } = req.body
  if (!userId) {
    res.status(400).json({ error: "缺少用户ID" })
    return
  }
  const drawCount = count === 10 ? 10 : 1
  const result = packs.drawPack(userId, packId, drawCount as 1 | 10)
  if ("error" in result) {
    res.status(400).json({ error: result.error })
    return
  }
  res.json(result)
})

router.get("/:packId/pity", (req: Request, res: Response) => {
  const { packId } = req.params
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: "缺少用户ID" })
    return
  }
  res.json(packs.getPityCounter(userId as string, packId))
})

export default router
