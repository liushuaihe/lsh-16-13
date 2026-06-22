import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express"
import cors from "cors"
import dotenv from "dotenv"
import tradingRoutes from "./routes/trading.js"
import packsRoutes from "./routes/packs.js"
import assetsRoutes from "./routes/assets.js"
import marketRoutes from "./routes/market.js"
import { initDB } from "./db.js"

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use("/api/trading", tradingRoutes)
app.use("/api/packs", packsRoutes)
app.use("/api/assets", assetsRoutes)
app.use("/api/market", marketRoutes)

app.use("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "ok" })
})

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server error:", error)
  res.status(500).json({ success: false, error: "Server internal error" })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "API not found" })
})

export { initDB }
export default app
