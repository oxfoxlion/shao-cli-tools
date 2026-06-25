import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { AuthError, NetworkError } from '../../lib/api.js'
import {
  fetchMe, login, register, logout,
  fetchProfile, fetchEntries, createEntry,
  type User,
} from './client.js'
import { showProfile, showPublicEntries, showAddEntry } from './views.js'

async function readCredentials(): Promise<{ nickname: string; pin: string } | null> {
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  process.stdin.setRawMode(false)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  const readLine = (prompt: string): Promise<string | null> =>
    new Promise((resolve) => {
      process.stdout.write(prompt)
      let buf = ''
      const onData = (data: string) => {
        if (data === '\r' || data === '\n') {
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(buf.trim())
        } else if (data === '\x03') {
          process.stdin.off('data', onData)
          resolve(null)
        } else if (data === '\x7f' || data === '\x08') {
          if (buf.length > 0) { buf = buf.slice(0, -1); process.stdout.write('\b \b') }
        } else {
          buf += data
          process.stdout.write(data)
        }
      }
      process.stdin.on('data', onData)
    })

  const readPin = (prompt: string): Promise<string | null> =>
    new Promise((resolve) => {
      process.stdout.write(prompt)
      let buf = ''
      const onData = (data: string) => {
        if (data === '\r' || data === '\n') {
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          resolve(buf.trim())
        } else if (data === '\x03') {
          process.stdin.off('data', onData)
          resolve(null)
        } else if (data === '\x7f' || data === '\x08') {
          if (buf.length > 0) { buf = buf.slice(0, -1); process.stdout.write('\b \b') }
        } else if (/^\d$/.test(data) && buf.length < 6) {
          buf += data
          process.stdout.write('*')
        }
      }
      process.stdin.on('data', onData)
    })

  const nickname = await readLine('暱稱：')
  if (nickname === null) { process.stdin.setRawMode(true); return null }

  const pin = await readPin('6 位 PIN：')
  process.stdin.setRawMode(true)
  if (pin === null) return null

  return { nickname, pin }
}

async function runAuthFlow(): Promise<User | null> {
  clearScreen()
  hideCursor()
  process.stdout.write(chalk.bold('小小好事 — 登入\n\n'))
  process.stdout.write(`  ▶ 登入\n`)
  process.stdout.write(`    註冊\n`)
  process.stdout.write(`    ──────────\n`)
  process.stdout.write(`    取消\n`)
  process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇\n'))

  const items = ['登入', '註冊', '取消']
  let selected = 0

  const render = () => {
    clearScreen()
    process.stdout.write(chalk.bold('小小好事 — 登入\n\n'))
    items.forEach((label, i) => {
      if (i === 2) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'up') { selected = (selected - 1 + 3) % 3; render() }
    else if (key === 'down') { selected = (selected + 1) % 3; render() }
    else if (key === 'q' || key === 'ctrl+c') return null
    else if (key === 'enter') {
      if (selected === 2) return null

      clearScreen()
      process.stdout.write(chalk.bold(`小小好事 — ${items[selected]}\n\n`))
      const creds = await readCredentials()
      if (!creds) return null

      try {
        clearScreen()
        process.stdout.write(chalk.dim('處理中...\n'))
        const user = selected === 0
          ? await login(creds.nickname, creds.pin)
          : await register(creds.nickname, creds.pin)
        return user
      } catch (err) {
        const msg = err instanceof NetworkError
          ? err.message
          : err instanceof AuthError
            ? '暱稱或 PIN 錯誤'
            : '發生錯誤，請稍後再試'
        process.stdout.write(chalk.red(`\n${msg}\n`))
        process.stdout.write(chalk.dim('按任意鍵重試...\n'))
        await waitForKey()
        render()
      }
    }
  }
}

export async function runGoodthing(): Promise<void> {
  clearScreen()
  hideCursor()
  process.stdout.write(chalk.dim('確認登入狀態...\n'))

  let user: User | null = null
  try {
    const res = await fetchMe()
    user = res.user
  } catch (err) {
    if (!(err instanceof AuthError)) {
      showCursor()
      if (err instanceof NetworkError) {
        process.stdout.write(chalk.red(`\n錯誤：${err.message}\n`))
      }
      process.stdout.write(chalk.dim('按任意鍵返回...\n'))
      await waitForKey()
      return
    }
    user = await runAuthFlow()
    if (!user) return
  }

  const menuItems = ['瀏覽今日好事', '新增好事', '我的紀錄', '登出', '回上層']
  const TOTAL = menuItems.length
  let selected = 0

  const render = () => {
    clearScreen()
    process.stdout.write(chalk.bold(`小小好事  ${chalk.dim(`@${user!.nickname}`)}\n\n`))
    menuItems.forEach((label, i) => {
      if (i === 3) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 回上層\n'))
  }

  while (true) {
    render()
    const key = await waitForKey()

    if (key === 'up') { selected = (selected - 1 + TOTAL) % TOTAL }
    else if (key === 'down') { selected = (selected + 1) % TOTAL }
    else if (key === 'q' || key === 'ctrl+c') break
    else if (key === 'enter') {
      showCursor()
      try {
        if (selected === 0) {
          clearScreen()
          process.stdout.write(chalk.dim('載入好事...\n'))
          const res = await fetchEntries()
          await showPublicEntries(res.entries)
        } else if (selected === 1) {
          const form = await showAddEntry()
          if (form) {
            clearScreen()
            process.stdout.write(chalk.dim('送出中...\n'))
            await createEntry(form)
            process.stdout.write(chalk.green('✓ 好事已記錄！\n'))
            process.stdout.write(chalk.dim('按任意鍵返回...\n'))
            await waitForKey()
          }
        } else if (selected === 2) {
          clearScreen()
          process.stdout.write(chalk.dim('載入紀錄...\n'))
          const res = await fetchProfile()
          await showProfile(res)
        } else if (selected === 3) {
          clearScreen()
          process.stdout.write(chalk.dim('登出中...\n'))
          await logout()
          process.stdout.write(chalk.green('✓ 已登出\n'))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
          break
        } else if (selected === 4) {
          break
        }
      } catch (err) {
        if (err instanceof NetworkError) {
          process.stdout.write(chalk.red(`\n錯誤：${err.message}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        }
      }
      hideCursor()
    }
  }
}
