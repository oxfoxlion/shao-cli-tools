import { apiGet } from '../../lib/api.js'

export interface BookSummary {
  id: number
  title: string
  authors: string[]
  languages: string[]
  hasText: boolean
}

export interface BookDetail extends BookSummary {
  subjects: string[]
}

export interface SearchResponse {
  count: number
  next: boolean
  results: BookSummary[]
}

export interface ContentResponse {
  page: number
  totalPages: number
  lines: string[]
}

export const searchBooks = (q: string, lang?: string, page = 1): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q, page: String(page) })
  if (lang) params.set('lang', lang)
  return apiGet<SearchResponse>(`/books/search?${params}`)
}

export const getBook = (id: number): Promise<BookDetail> =>
  apiGet<BookDetail>(`/books/${id}`)

export const getContent = (id: number, page = 1): Promise<ContentResponse> =>
  apiGet<ContentResponse>(`/books/${id}/content?page=${page}`)
