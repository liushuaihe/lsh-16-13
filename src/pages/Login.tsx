import { useState } from "react"
import { useAppStore } from "@/store"

export default function Login() {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { login } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError("")
    try {
      await login(username.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gold mb-6 glow-gold">
            <span className="font-display text-primary text-3xl font-bold">C</span>
          </div>
          <h1 className="font-display text-gold text-2xl tracking-widest mb-2">CARD EXCHANGE</h1>
          <p className="text-muted text-sm">纸牌集市 · 微型交易所</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-secondary rounded-xl border border-border p-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-muted mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入你的用户名"
              className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-dimmed focus:outline-none focus:border-gold/50 transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-down text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-gold text-primary font-bold text-sm py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "连接中..." : "进入集市"}
          </button>

          <p className="text-center text-xs text-dimmed">
            新用户将自动注册并获得 10,000 金币
          </p>
        </form>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {["TraderAlice", "CardHunter", "PackLover"].map((name) => (
            <button
              key={name}
              onClick={() => setUsername(name)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-muted hover:text-gold hover:border-gold/30 transition-colors truncate"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
