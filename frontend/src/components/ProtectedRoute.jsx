import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../context/useAuth'

function ProtectedRoute() {
  const { loading, user } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-400">Loading...</div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export default ProtectedRoute