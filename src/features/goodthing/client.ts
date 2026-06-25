import { BASE_URL, AuthError, NetworkError, apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api.js'
import { setGoodCalendarSession, clearGoodCalendarSession } from '../../lib/session.js'

export interface User {
  id: string
  nickname: string
  created_at: string
  last_login_at: string | null
}

export interface Entry {
  id: string
  user_id: string | null
  nickname: string
  content: string
  date: string
  mood_temperature: number
  hide_from_global_feed: boolean
  skip_discord_notification: boolean
  created_at: string
}

export interface StreakSummary {
  current_streak: number
  longest_streak: number
  next_badge_days: number | null
  badges: Array<{ days: 7 | 14 | 28 | 50 | 100; earned: boolean }>
}

export interface ProfileResponse {
  user: User
  profile: {
    month: string
    total_entries: number
    last_entry_at: string | null
    active_dates_this_month: string[]
    month_entries: Entry[]
    recent_entries: Entry[]
    streak_summary: StreakSummary
  }
}

export interface CreateEntryBody {
  content: string
  date: string
  nickname?: string
  mood_temperature?: number
  hide_from_global_feed?: boolean
}

async function authRequest(path: string, body: Record<string, string>): Promise<User> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new NetworkError(`無法連線到伺服器：${(err as Error).message}`)
  }

  if (response.status === 401) throw new AuthError()
  if (!response.ok) throw new NetworkError(`伺服器錯誤：${response.status}`)

  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    const match = setCookie.match(/good_calendar_session=([^;]+)/)
    if (match) setGoodCalendarSession(match[1])
  }

  const data = await response.json() as { user: User }
  return data.user
}

export const fetchMe = (): Promise<{ user: User }> =>
  apiGet<{ user: User }>('/good_calendar/auth/me')

export const login = (nickname: string, pin: string): Promise<User> =>
  authRequest('/good_calendar/auth/login', { nickname, pin })

export const register = (nickname: string, pin: string): Promise<User> =>
  authRequest('/good_calendar/auth/register', { nickname, pin })

export async function logout(): Promise<void> {
  await apiPost('/good_calendar/auth/logout')
  clearGoodCalendarSession()
}

export const fetchProfile = (month?: string): Promise<ProfileResponse> =>
  apiGet<ProfileResponse>(`/good_calendar/auth/profile${month ? `?month=${month}` : ''}`)

export const fetchEntries = (): Promise<{ entries: Entry[] }> =>
  apiGet<{ entries: Entry[] }>('/good_calendar/entries')

export const createEntry = (body: CreateEntryBody): Promise<{ entry: Entry }> =>
  apiPost<{ entry: Entry }>('/good_calendar/entries', body)

export const updateEntry = (id: string, body: Partial<CreateEntryBody>): Promise<{ entry: Entry }> =>
  apiPatch<{ entry: Entry }>(`/good_calendar/entries/${id}`, body)

export const deleteEntry = (id: string): Promise<{ deleted: boolean }> =>
  apiDelete<{ deleted: boolean }>(`/good_calendar/entries/${id}`)
