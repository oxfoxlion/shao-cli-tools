import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const SESSION_DIR = join(homedir(), '.config', 'shao')
const SESSION_FILE = join(SESSION_DIR, 'session.json')

interface SessionData {
  app_session?: string
}

function readSession(): SessionData {
  try {
    if (!existsSync(SESSION_FILE)) return {}
    const raw = JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as Record<string, unknown>
    // one-time migration from old key
    if (raw['good_calendar_session'] && !raw['app_session']) {
      raw['app_session'] = raw['good_calendar_session']
      delete raw['good_calendar_session']
      writeSession(raw as SessionData)
    }
    return raw as SessionData
  } catch {
    return {}
  }
}

function writeSession(data: SessionData): void {
  mkdirSync(SESSION_DIR, { recursive: true })
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2))
}

export function getAppSession(): string | undefined {
  return readSession().app_session
}

export function setAppSession(token: string): void {
  const data = readSession()
  data.app_session = token
  writeSession(data)
}

export function clearAppSession(): void {
  const data = readSession()
  delete data.app_session
  writeSession(data)
}
