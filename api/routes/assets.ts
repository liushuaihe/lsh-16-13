import { Router, type Request, type Response } from "express"
import * as assetsService from "../services/assets.js"

const router = Router()

router.get("/", (req: Request, res: Response) => {
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: "缺少用户ID" })
    return
  }
  const result = assetsService.getUserAssets(userId as string)
  if (!result) {
    res.status(404).json({ error: "用户不存在" })
    return
  }
  res.json(result)
})

router.post("/deposit", (req: Request, res: Response) => {
  const { userId, amount } = req.body
  if (!userId || !amount) {
    res.status(400).json({ error: "参数不完整" })
    return
  }
  res.json(assetsService.deposit(userId, Number(amount)))
})

router.post("/login", (req: Request, res: Response) => {
  const { username } = req.body
  if (!username) {
    res.status(400).json({ error: "缺少用户名" })
    return
  }
  res.json(assetsService.loginOrCreate(username))
})

export default router
