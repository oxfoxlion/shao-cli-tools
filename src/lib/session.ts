import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const SESSION_DIR = join(homedir(), '.config', 'shao')
const SESSION_FILE = join(SESSION_DIR, 'session.json')

interface SessionData {
  good_calendar_session?: string
}

function readSession(): SessionData {
  try {
    if (!existsSync(SESSION_FILE)) return {}
    return JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as SessionData
  } catch {
    return {}
  }
}

function writeSession(data: SessionData): void {
  mkdirSync(SESSION_DIR, { recursive: true })
  writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2))
}

export function getGoodCalendarSession(): string | undefined {
  return readSession().good_calendar_session
}

export function setGoodCalendarSession(token: string): void {
  const data = readSession()
  data.good_calendar_session = token
  writeSession(data)
}

export function clearGoodCalendarSession(): void {
  const data = readSession()
  delete data.good_calendar_session
  writeSession(data)
}
