import { apiGet, apiPost } from '../../lib/api.js'

export interface Game {
  id: string
  title: string
  description: string
  hasLeaderboard: boolean
}

export interface SessionCreated {
  sessionId: string
  frame: string
  tick: number
}

export interface FrameResponse {
  frame: string
  tick: number
}

export type InputResponse =
  | { frame: string; tick: number; over: false; result: null }
  | { frame: string; tick: number; over: true; result: 'win' | 'loss' }
  | { quit: true }

export const fetchGames = (): Promise<Game[]> =>
  apiGet<Game[]>('/game_service/games')

export const createSession = (gameId: string, nickname?: string): Promise<SessionCreated> =>
  apiPost<SessionCreated>(`/game_service/games/${gameId}/sessions`, nickname ? { nickname } : undefined)

export const sendInput = (sessionId: string, key: string): Promise<InputResponse> =>
  apiPost<InputResponse>(`/game_service/sessions/${sessionId}/input`, { key })

export const fetchFrame = (sessionId: string): Promise<FrameResponse> =>
  apiGet<FrameResponse>(`/game_service/sessions/${sessionId}/frame`)
