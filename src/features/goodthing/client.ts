import { BASE_URL, AuthError, NetworkError, apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api.js'
import { setAppSession, clearAppSession } from '../../lib/session.js'

export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
  nickname: string | null
  twoFactorEnabled: boolean
  hasPassword: boolean
  hasPin: boolean
  googleLinked: boolean
  discordLinked: boolean
  createdAt: string
  lastLoginAt: string | null
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

// Re-export for compatibility with index.ts
export type User = AuthUser

async function authRequest(path: string, body: Record<string, string>): Promise<AuthUser> {
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
    const match = setCookie.match(/app_session=([^;]+)/)
    if (match) setAppSession(match[1])
  }

  const data = await response.json() as { user?: AuthUser; require2FA?: boolean }
  if (data.require2FA) throw new NetworkError('此帳號已啟用兩步驟驗證，請改用網頁版登入')
  if (!data.user) throw new NetworkError('登入回應格式錯誤')
  return data.user
}

export const fetchMe = (): Promise<{ user: AuthUser }> =>
  apiGet<{ user: AuthUser }>('/auth/me')

export const login = (nickname: string, pin: string): Promise<AuthUser> =>
  authRequest('/auth/login', { nickname, pin })

export const register = (nickname: string, pin: string): Promise<AuthUser> =>
  authRequest('/auth/register', { nickname, pin })

export async function logout(): Promise<void> {
  await apiPost('/auth/logout')
  clearAppSession()
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
