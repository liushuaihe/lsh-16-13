import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useAppStore } from "@/store"
import Layout from "@/components/Layout"
import Trading from "@/pages/Trading"
import Packs from "@/pages/Packs"
import Chart from "@/pages/Chart"
import Assets from "@/pages/Assets"
import Login from "@/pages/Login"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAppStore()
  const [loading, setLoading] = useState(!initialized)

  useEffect(() => {
    if (!initialized) {
      const savedUsername = localStorage.getItem("username")
      if (savedUsername) {
        useAppStore.getState().login(savedUsername).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [initialized])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary">
        <div className="text-gold font-display text-lg animate-pulse">LOADING...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<Trading />} />
          <Route path="/packs" element={<Packs />} />
          <Route path="/chart" element={<Chart />} />
          <Route path="/assets" element={<Assets />} />
        </Route>
      </Routes>
    </Router>
  )
}
