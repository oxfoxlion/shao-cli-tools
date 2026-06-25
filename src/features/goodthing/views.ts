import chalk from 'chalk'
import { clearScreen, hideCursor } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import type { ProfileResponse, Entry } from './client.js'

const STAR = '★'

function formatEntry(entry: Entry): string {
  const prefix = `  ${entry.date}  ${STAR}${entry.mood_temperature}  ${entry.nickname}：`
  const maxContent = Math.max(10, (process.stdout.columns ?? 80) - prefix.length - 1)
  const content = entry.content.length > maxContent
    ? entry.content.slice(0, maxContent - 1) + '…'
    : entry.content
  return prefix + content
}

export async function showProfile(data: ProfileResponse): Promise<void> {
  const { profile } = data
  const { streak_summary: s } = profile

  clearScreen()
  hideCursor()
  process.stdout.write(chalk.bold('我的小小好事\n\n'))

  const nextBadge = s.next_badge_days !== null ? `下一個徽章：${s.next_badge_days} 天` : '全部達成！'
  process.stdout.write(`🔥 連續 ${s.current_streak} 天  ｜  最長 ${s.longest_streak} 天  ｜  ${nextBadge}\n`)

  const badgeStr = s.badges.map((b) => (b.earned ? `[✓] ${b.days}天` : `[ ] ${b.days}天`)).join('  ')
  process.stdout.write(`徽章：${badgeStr}\n\n`)

  process.stdout.write(`本月已記錄：${profile.month_entries.length} 筆\n\n`)

  const entries = profile.recent_entries
  const PAGE = 5
  let offset = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('我的小小好事\n\n'))
    process.stdout.write(`🔥 連續 ${s.current_streak} 天  ｜  最長 ${s.longest_streak} 天  ｜  ${nextBadge}\n`)
    process.stdout.write(`徽章：${badgeStr}\n\n`)
    process.stdout.write(`本月已記錄：${profile.month_entries.length} 筆\n\n`)

    if (entries.length === 0) {
      process.stdout.write(chalk.dim('尚無紀錄\n'))
    } else {
      process.stdout.write(`最近紀錄：\n`)
      entries.slice(offset, offset + PAGE).forEach((entry) => {
        process.stdout.write(`${formatEntry(entry)}\n`)
      })
    }
    process.stdout.write(chalk.dim('\nj/k 滾動  q 回選單\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'enter' || key === 'ctrl+c') break
    if ((key === 'down' || key === 'j') && offset + PAGE < entries.length) { offset++; render() }
    if ((key === 'up' || key === 'k') && offset > 0) { offset--; render() }
  }
}

export async function showPublicEntries(entries: Entry[]): Promise<void> {
  clearScreen()
  hideCursor()
  process.stdout.write(chalk.bold('今日好事\n\n'))

  if (entries.length === 0) {
    process.stdout.write(chalk.dim('目前還沒有人分享好事\n'))
  } else {
    const pageSize = 5
    let offset = 0

    const render = () => {
      clearScreen()
      process.stdout.write(chalk.bold('今日好事\n\n'))
      entries.slice(offset, offset + pageSize).forEach((entry) => {
        process.stdout.write(`${formatEntry(entry)}\n`)
      })
      const hasMore = offset + pageSize < entries.length
      process.stdout.write(chalk.dim(`\nj/k 滾動  q 回選單${hasMore ? '  (更多)' : ''}\n`))
    }

    render()

    while (true) {
      const key = await waitForKey()
      if (key === 'q' || key === 'ctrl+c') break
      if (key === 'j' || key === 'down') {
        if (offset + pageSize < entries.length) { offset += pageSize; render() }
      }
      if (key === 'k' || key === 'up') {
        if (offset > 0) { offset -= pageSize; render() }
      }
    }
  }
}

export interface NewEntryForm {
  date: string
  mood_temperature: number
  content: string
}

function todayTW(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

function lastMonthFirst(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  d.setDate(1)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
}

async function readLine(prompt: string, defaultValue?: string): Promise<string | null> {
  process.stdout.write(prompt)
  if (defaultValue) process.stdout.write(chalk.dim(`（預設：${defaultValue}）`))
  process.stdout.write(' ')

  return new Promise((resolve) => {
    let buf = ''
    const onData = (data: string) => {
      if (data === '\r' || data === '\n') {
        process.stdin.off('data', onData)
        process.stdout.write('\n')
        resolve(buf.trim() || defaultValue || '')
      } else if (data === '\x03') {
        process.stdin.off('data', onData)
        resolve(null)
      } else if (data === '\x7f' || data === '\x08') {
        if (buf.length > 0) {
          buf = buf.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else if (data >= ' ') {
        buf += data
        process.stdout.write(data)
      }
    }
    process.stdin.on('data', onData)
  })
}

export async function showAddEntry(): Promise<NewEntryForm | null> {
  clearScreen()
  process.stdout.write(chalk.bold('新增好事\n\n'))
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  const today = todayTW()
  const minDate = lastMonthFirst()

  const dateInput = await readLine(`步驟 1 / 日期 (${minDate} ～ ${today})：`, today)
  if (dateInput === null) return null

  const moodInput = await readLine('步驟 2 / 心情溫度 (1–10)：', '5')
  if (moodInput === null) return null
  const mood = parseInt(moodInput, 10)
  if (isNaN(mood) || mood < 1 || mood > 10) {
    process.stdout.write(chalk.red('心情溫度必須是 1–10 的數字\n'))
    await readLine('按 Enter 返回...')
    return null
  }

  const contentInput = await readLine('步驟 3 / 好事內容 (最多 280 字)：')
  if (contentInput === null || contentInput.trim() === '') return null
  if (contentInput.length > 280) {
    process.stdout.write(chalk.red('內容不能超過 280 字\n'))
    await readLine('按 Enter 返回...')
    return null
  }

  process.stdout.write('\n──────────\n')
  process.stdout.write(`日期：${dateInput}\n`)
  process.stdout.write(`心情：${STAR}${mood}\n`)
  process.stdout.write(`內容：${contentInput}\n`)
  process.stdout.write('──────────\n')
  process.stdout.write(chalk.dim('Enter 確認送出  q 取消\n'))

  const confirm = await waitForKey()
  if (confirm !== 'enter') return null

  return { date: dateInput, mood_temperature: mood, content: contentInput }
}
