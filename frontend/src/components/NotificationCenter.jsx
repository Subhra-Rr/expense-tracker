import { useEffect, useState } from 'react'
import api from '../services/api'
import { errorMessage } from '../utils/errorMessage'

function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [preferences, setPreferences] = useState({ budgetAlerts: true, recurringAlerts: true })
  const [error, setError] = useState('')

  async function load() {
    try {
      const [{ data: notificationData }, { data: preferenceData }] = await Promise.all([api.get('/notifications'), api.get('/notifications/preferences')])
      setNotifications(notificationData.notifications)
      setUnreadCount(notificationData.unreadCount)
      setPreferences(preferenceData.preferences)
      setError('')
    } catch (requestError) { setError(errorMessage(requestError, 'Unable to load notifications')) }
  }

  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 60000)
    return () => clearInterval(timer)
  }, [])

  async function markRead(id) { await api.patch(`/notifications/${id}/read`); void load() }
  async function dismiss(id) { await api.patch(`/notifications/${id}/dismiss`); void load() }
  async function markAllRead() { await api.patch('/notifications/read-all'); void load() }
  async function updatePreference(name) {
    const next = { ...preferences, [name]: !preferences[name] }
    await api.put('/notifications/preferences', next)
    setPreferences(next)
    void load()
  }

  return <div className="relative"><button className="relative grid size-11 place-items-center rounded-xl border border-slate-700 text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300" type="button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">&#128276;</span>{unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>{open && <div className="absolute right-0 z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left shadow-2xl"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-white">Notifications</h2><button className="text-xs font-medium text-cyan-300" type="button" onClick={markAllRead}>Mark all read</button></div>{error && <p className="mt-3 text-xs text-red-300">{error}</p>}<div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{notifications.length === 0 ? <p className="py-5 text-sm text-slate-400">You are all caught up.</p> : notifications.map((notification) => <article className={`rounded-xl border p-3 ${notification.readAt ? 'border-slate-700 bg-slate-950/40' : 'border-cyan-900 bg-cyan-950/30'}`} key={notification._id}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-white">{notification.title}</p><button className="text-xs text-slate-500 hover:text-white" type="button" aria-label="Dismiss notification" onClick={() => dismiss(notification._id)}>Dismiss</button></div><p className="mt-1 text-xs leading-5 text-slate-300">{notification.message}</p>{!notification.readAt && <button className="mt-2 text-xs font-medium text-cyan-300" type="button" onClick={() => markRead(notification._id)}>Mark as read</button>}</article>)}</div><div className="mt-4 border-t border-slate-700 pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preferences</p><label className="flex items-center justify-between gap-3 py-1 text-sm text-slate-300">Budget alerts<input type="checkbox" checked={preferences.budgetAlerts} onChange={() => updatePreference('budgetAlerts')} /></label><label className="flex items-center justify-between gap-3 py-1 text-sm text-slate-300">Recurring due alerts<input type="checkbox" checked={preferences.recurringAlerts} onChange={() => updatePreference('recurringAlerts')} /></label></div></div>}</div>
}

export default NotificationCenter
