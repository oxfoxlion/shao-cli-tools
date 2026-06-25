import chalk from 'chalk'
import { clearScreen, cursorHome, showCursor } from '../../lib/screen.js'
import { startInput, waitForKey } from '../../lib/input.js'
import { createSession, sendInput, fetchFrame } from './client.js'
import type { Game } from './client.js'

const POLL_INTERVAL_MS = 80
const REALTIME_DETECT_MS = 500

export async function playGame(game: Game): Promise<void> {
  clearScreen()
  process.stdout.write(chalk.dim(`載入 ${game.title}...\n`))

  const session = await createSession(game.id)
  process.stdout.write(session.frame)

  const isRealtime = await detectRealtime(session.sessionId, session.tick)
  await runGameLoop(session.sessionId, isRealtime)
}

async function detectRealtime(sessionId: string, initialTick: number): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, REALTIME_DETECT_MS))
  try {
    const frame = await fetchFrame(sessionId)
    return frame.tick > initialTick
  } catch {
    return false
  }
}

async function runGameLoop(sessionId: string, isRealtime: boolean): Promise<void> {
  let done = false
  let lastTick = -1

  const render = (frame: string) => {
    cursorHome()
    process.stdout.write(frame)
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  if (isRealtime) {
    pollTimer = setInterval(async () => {
      if (done) return
      try {
        const res = await fetchFrame(sessionId)
        if (res.tick !== lastTick) {
          lastTick = res.tick
          render(res.frame)
        }
      } catch {
        // network blip — keep running
      }
    }, POLL_INTERVAL_MS)
  }

  await new Promise<void>((resolve) => {
    const stopInput = startInput(async (key) => {
      if (done) return
      if (key === 'ctrl+c') {
        done = true
        if (pollTimer) clearInterval(pollTimer)
        stopInput()
        resolve()
        return
      }

      try {
        const res = await sendInput(sessionId, key)
        if ('quit' in res) {
          done = true
          if (pollTimer) clearInterval(pollTimer)
          stopInput()
          resolve()
          return
        }
        render(res.frame)
        lastTick = res.tick
        if (res.over) {
          done = true
          if (pollTimer) clearInterval(pollTimer)
          stopInput()
          await showGameOver(res.result)
          resolve()
        }
      } catch {
        // ignore input errors
      }
    })
  })
}

async function showGameOver(result: 'win' | 'loss'): Promise<void> {
  const msg = result === 'win'
    ? chalk.green('\n🎉 恭喜！你贏了！')
    : chalk.red('\n💀 遊戲結束')
  process.stdout.write(`${msg}\n`)
  process.stdout.write(chalk.dim('按任意鍵回選單...\n'))
  showCursor()
  await waitForKey()
}
