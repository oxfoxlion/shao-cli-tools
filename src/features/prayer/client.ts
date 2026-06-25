import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api.js'

export interface Book {
  id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  book_id: string | null
  title: string
  content: string | null
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
  recurrence_config: Record<string, unknown> | null
  is_answered: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ItemSummary {
  id: string
  title: string
  content: string | null
  recurrence: string
  is_answered: boolean
}

export interface Entry {
  id: string
  book_id: string
  content: string | null
  prayed_at: string
  created_at: string
  updated_at: string
  items?: ItemSummary[]
}

// ─── Books ────────────────────────────────────────────────────────────────────

export const fetchBooks = (): Promise<{ books: Book[] }> =>
  apiGet<{ books: Book[] }>('/prayer/books')

export const createBook = (title: string, description?: string): Promise<{ book: Book }> =>
  apiPost<{ book: Book }>('/prayer/books', { title, ...(description ? { description } : {}) })

export const updateBook = (id: string, data: { title?: string; description?: string }): Promise<{ book: Book }> =>
  apiPut<{ book: Book }>(`/prayer/books/${id}`, data)

export const deleteBook = (id: string): Promise<{ message: string }> =>
  apiDelete<{ message: string }>(`/prayer/books/${id}`)

// ─── Items ────────────────────────────────────────────────────────────────────

export interface FetchItemsParams {
  book_id?: string
  is_answered?: boolean
  is_archived?: boolean
}

export const fetchItems = (params?: FetchItemsParams): Promise<{ items: Item[] }> => {
  const q = new URLSearchParams()
  if (params?.book_id) q.set('book_id', params.book_id)
  if (params?.is_answered !== undefined) q.set('is_answered', String(params.is_answered))
  if (params?.is_archived !== undefined) q.set('is_archived', String(params.is_archived))
  const qs = q.toString()
  return apiGet<{ items: Item[] }>(`/prayer/items${qs ? `?${qs}` : ''}`)
}

export interface CreateItemBody {
  title: string
  content?: string
  book_id?: string
  recurrence?: string
}

export const createItem = (body: CreateItemBody): Promise<{ item: Item }> =>
  apiPost<{ item: Item }>('/prayer/items', body)

export const updateItem = (id: string, body: Partial<CreateItemBody>): Promise<{ item: Item }> =>
  apiPut<{ item: Item }>(`/prayer/items/${id}`, body)

export const deleteItem = (id: string): Promise<{ message: string }> =>
  apiDelete<{ message: string }>(`/prayer/items/${id}`)

export const toggleAnswer = (id: string): Promise<{ item: { id: string; is_answered: boolean } }> =>
  apiPost<{ item: { id: string; is_answered: boolean } }>(`/prayer/items/${id}/answer`)

export const toggleArchive = (id: string): Promise<{ item: { id: string; is_archived: boolean } }> =>
  apiPost<{ item: { id: string; is_archived: boolean } }>(`/prayer/items/${id}/archive`)

// ─── Entries ──────────────────────────────────────────────────────────────────

export const fetchEntries = (bookId: string, before?: string): Promise<{ entries: Entry[] }> => {
  const q = new URLSearchParams()
  if (before) q.set('before', before)
  const qs = q.toString()
  return apiGet<{ entries: Entry[] }>(`/prayer/books/${bookId}/entries${qs ? `?${qs}` : ''}`)
}

export interface CreateEntryBody {
  content?: string
  prayed_at?: string
  item_ids?: string[]
}

export const createEntry = (bookId: string, body: CreateEntryBody): Promise<{ entry: Entry }> =>
  apiPost<{ entry: Entry }>(`/prayer/books/${bookId}/entries`, body)

export const fetchEntry = (bookId: string, entryId: string): Promise<{ entry: Entry }> =>
  apiGet<{ entry: Entry }>(`/prayer/books/${bookId}/entries/${entryId}`)

export const deleteEntry = (bookId: string, entryId: string): Promise<{ message: string }> =>
  apiDelete<{ message: string }>(`/prayer/books/${bookId}/entries/${entryId}`)
