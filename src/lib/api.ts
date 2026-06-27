import { getAppSession } from './session.js'

export const BASE_URL = 'https://backend.instantcheeseshao.com'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const session = getAppSession()
  if (session) {
    headers['Cookie'] = `app_session=${session}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new NetworkError(`無法連線到伺服器：${(err as Error).message}`)
  }

  if (response.status === 401) throw new AuthError()
  if (!response.ok) {
    let body = ''
    try { body = await response.text() } catch { /* ignore */ }
    throw new NetworkError(`伺服器錯誤：${response.status}${body ? `\n${body}` : ''}`)
  }

  return response.json() as Promise<T>
}

export const apiGet = <T>(path: string): Promise<T> => apiFetch<T>('GET', path)
export const apiPost = <T>(path: string, body?: unknown): Promise<T> => apiFetch<T>('POST', path, body)
export const apiPut = <T>(path: string, body?: unknown): Promise<T> => apiFetch<T>('PUT', path, body)
export const apiPatch = <T>(path: string, body?: unknown): Promise<T> => apiFetch<T>('PATCH', path, body)
export const apiDelete = <T>(path: string): Promise<T> => apiFetch<T>('DELETE', path)
