const GUTENDEX = 'https://gutendex.com'

export interface GutendexAuthor {
  name: string
  birth_year: number | null
  death_year: number | null
}

export interface GutendexBook {
  id: number
  title: string
  authors: GutendexAuthor[]
  languages: string[]
  subjects: string[]
  formats: Record<string, string>
  download_count: number
}

export interface SearchResponse {
  count: number
  next: string | null
  results: GutendexBook[]
}

export function getTextUrl(formats: Record<string, string>): string | null {
  for (const key of ['text/plain; charset=utf-8', 'text/plain; charset=us-ascii', 'text/plain']) {
    if (formats[key]) return formats[key]
  }
  return null
}

async function gutendexFetch<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(`無法連線，請確認網路：${(err as Error).message}`)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const searchBooks = (q: string, lang?: string, page = 1): Promise<SearchResponse> => {
  const params = new URLSearchParams({ search: q, page: String(page) })
  if (lang) params.set('languages', lang)
  return gutendexFetch<SearchResponse>(`${GUTENDEX}/books?${params}`)
}

export const getBook = (id: number): Promise<GutendexBook> =>
  gutendexFetch<GutendexBook>(`${GUTENDEX}/books/${id}`)

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; shao-cli-tools/1.0)',
  'Accept': 'text/plain,text/html,*/*',
}

function buildFetchCandidates(textUrl: string): string[] {
  const idMatch = textUrl.match(/\/files\/(\d+)\//)
  const id = idMatch?.[1]

  const candidates: string[] = [
    textUrl,
    textUrl.replace('https://www.gutenberg.org', 'http://gutenberg.pglaf.org'),
    textUrl.replace('https://www.gutenberg.org', 'https://gutenberg.pglaf.org'),
  ]

  if (id) {
    candidates.push(
      `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
      `http://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    )
  }

  return candidates
}

export async function fetchLines(textUrl: string): Promise<string[]> {
  const candidates = buildFetchCandidates(textUrl)
  let lastErr: Error = new Error('unknown error')

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        lastErr = new Error(`下載失敗：HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      return text.split('\n')
    } catch (err) {
      const cause = (err as NodeJS.ErrnoException).cause ?? err
      lastErr = new Error((cause as Error).message ?? (err as Error).message)
    }
  }

  throw new Error(`無法取得書本內容：${lastErr.message}`)
}
