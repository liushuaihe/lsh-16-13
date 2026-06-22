import { useState } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { LayoutDashboard, Package, TrendingUp, Wallet, LogOut, Shield } from "lucide-react"
import { useAppStore } from "@/store"
import { CREDIT_GRADE_COLORS } from "../../shared/types"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "交易大厅" },
  { to: "/packs", icon: Package, label: "盲包抽卡" },
  { to: "/chart", icon: TrendingUp, label: "走势看板" },
  { to: "/assets", icon: Wallet, label: "我的资产" },
]

export default function Layout() {
  const { user, creditInfo, logout } = useAppStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-primary">
      <aside
        className={`${collapsed ? "w-16" : "w-56"} flex flex-col border-r border-border bg-secondary transition-all duration-300 shrink-0`}
      >
        <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center shrink-0">
            <span className="font-display text-primary font-bold text-sm">C</span>
          </div>
          {!collapsed && (
            <span className="font-display text-gold text-sm tracking-wider">CARD EX</span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-2 my-2 text-dimmed hover:text-muted text-xs"
        >
          {collapsed ? "▶" : "◀"}
        </button>

        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-gold-dim text-gold"
                    : "text-muted hover:bg-hover hover:text-gold"
                }`
              }
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gold-dim flex items-center justify-center shrink-0">
                <span className="text-gold text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </span>
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted truncate">{user.username}</p>
                  <p className="text-xs text-gold font-display">
                    {(user.balance / 100).toFixed(0)}
                    <span className="text-dimmed ml-0.5">G</span>
                  </p>
                </div>
              )}
            </div>
            {!collapsed && creditInfo && (
              <div className="flex items-center gap-1.5 mb-2 text-[10px]">
                <Shield size={12} style={{ color: CREDIT_GRADE_COLORS[creditInfo.grade] }} />
                <span className="text-dimmed">信用等级:</span>
                <span
                  className="font-display font-bold"
                  style={{ color: CREDIT_GRADE_COLORS[creditInfo.grade] }}
                >
                  {creditInfo.grade}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 text-dimmed hover:text-down text-xs w-full px-2 py-1"
            >
              <LogOut size={14} />
              {!collapsed && <span>退出</span>}
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
