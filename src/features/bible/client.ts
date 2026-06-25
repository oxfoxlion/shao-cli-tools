import { apiGet, apiPost, apiDelete, apiPatch } from '../../lib/api.js'

export interface Book {
  id: string
  name: string
  testament: 'old' | 'new'
  chapters: number
}

export interface Verse {
  verse: number
  text: string
}

export interface BibleChapter {
  book_id: string
  book_name: string
  chapter: number
  verses: Verse[]
}

export interface Plan {
  id: string
  title: string
  description: string
  total_days: number
}

export interface DayPassage {
  book_id: string
  book_name: string
  chapter: number
}

export interface DayReading {
  day: number
  passages: DayPassage[]
}

export interface UserPlan {
  id: string
  plan_id: string
  start_date: string
  is_active: boolean
  created_at: string
  plan: Plan
}

export interface TodayReadingResponse {
  current_day: number
  total_days: number
  reading: DayReading
  completed_days: number[]
}

export interface Annotation {
  id: string
  book_id: string
  chapter: number
  verse: number
  note: string
  created_at: string
  updated_at: string
}

export interface SearchVerseResult {
  book_id: string
  book_name: string
  chapter: number
  verse: number
  text: string
}

// Public
export const fetchBooks = (): Promise<{ books: Book[] }> =>
  apiGet<{ books: Book[] }>('/bible/books')

export const fetchChapter = (bookId: string, chapter: number): Promise<{ chapter: BibleChapter }> =>
  apiGet<{ chapter: BibleChapter }>(`/bible/books/${bookId}/chapters/${chapter}`)

export const searchVerses = (q: string, limit = 20): Promise<{ keyword: string; count: number; verses: SearchVerseResult[] }> =>
  apiGet<{ keyword: string; count: number; verses: SearchVerseResult[] }>(
    `/bible/search?q=${encodeURIComponent(q)}&limit=${limit}`
  )

export const fetchPlans = (): Promise<{ plans: Plan[] }> =>
  apiGet<{ plans: Plan[] }>('/bible/plans')

// User plans (auth required)
export const fetchUserPlans = (): Promise<{ plans: UserPlan[] }> =>
  apiGet<{ plans: UserPlan[] }>('/bible/user/plans')

export const startUserPlan = (plan_id: string, start_date: string): Promise<{ plan: UserPlan }> =>
  apiPost<{ plan: UserPlan }>('/bible/user/plans', { plan_id, start_date })

export const deactivateUserPlan = (userPlanId: string): Promise<{ deactivated: boolean }> =>
  apiDelete<{ deactivated: boolean }>(`/bible/user/plans/${userPlanId}`)

export const fetchTodayReading = (userPlanId: string): Promise<TodayReadingResponse> =>
  apiGet<TodayReadingResponse>(`/bible/user/plans/${userPlanId}/today`)

export const markDayComplete = (userPlanId: string, day_number: number): Promise<{
  day_number: number
  already_completed: boolean
  completed_at: string | null
}> => apiPost(`/bible/user/plans/${userPlanId}/progress`, { day_number })

// Annotations (auth required)
export const fetchAnnotations = (book?: string, chapter?: number): Promise<{ annotations: Annotation[] }> => {
  const params = new URLSearchParams()
  if (book) params.set('book', book)
  if (chapter !== undefined) params.set('chapter', String(chapter))
  const query = params.toString()
  return apiGet<{ annotations: Annotation[] }>(`/bible/user/annotations${query ? `?${query}` : ''}`)
}

export const createAnnotation = (body: {
  book_id: string
  chapter: number
  verse: number
  note: string
}): Promise<{ annotation: Annotation }> =>
  apiPost<{ annotation: Annotation }>('/bible/user/annotations', body)

export const deleteAnnotation = (id: string): Promise<{ deleted: boolean }> =>
  apiDelete<{ deleted: boolean }>(`/bible/user/annotations/${id}`)

export const updateAnnotation = (id: string, note: string): Promise<{ annotation: Annotation }> =>
  apiPatch<{ annotation: Annotation }>(`/bible/user/annotations/${id}`, { note })
