import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { AuthError, NetworkError } from '../../lib/api.js'
import { fetchMe, login, register } from '../goodthing/client.js'
import {
  fetchBooks, fetchChapter, searchVerses,
  fetchPlans, fetchUserPlans, startUserPlan,
  fetchTodayReading, markDayComplete,
  fetchAnnotations, createAnnotation, deleteAnnotation,
  type Annotation, type UserPlan,
} from './client.js'
import {
  readLine, showBooks, showChapterSelect, showChapter,
  showSearchResults, showPlanSelect, showUserPlanMenu,
  showTodayReading, showAnnotationList,
} from './views.js'

function readLineRaw(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
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
      } else if (data >= ' ') {
        buf += data
        process.stdout.write(data)
      }
    }
    process.stdin.on('data', onData)
  })
}

function readPinRaw(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    let buf = ''
    const onData = (data: string) => {
      if (data === '\r' || data === '\n') {
        process.stdin.off('data', onData)
        process.stdout.write('\n')
        resolve(buf)
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
}

async function ensureAuth(): Promise<boolean> {
  try {
    await fetchMe()
    return true
  } catch (err) {
    if (!(err instanceof AuthError)) {
      if (err instanceof NetworkError) {
        process.stdout.write(chalk.red(`\n錯誤：${err.message}\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      }
      return false
    }
  }

  const items = ['登入', '註冊', '取消']
  let selected = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('需要登入\n\n'))
    process.stdout.write('讀經計劃和節次註記需要帳號（使用小小好事帳號）\n\n')
    items.forEach((label, i) => {
      if (i === 2) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇\n'))
  }

  render()

  let choice = -1
  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c') return false
    if (key === 'up' || key === 'k') { selected = (selected - 1 + 3) % 3; render() }
    else if (key === 'down' || key === 'j') { selected = (selected + 1) % 3; render() }
    else if (key === 'enter') { choice = selected; break }
  }

  if (choice === 2) return false

  clearScreen()
  showCursor()
  process.stdout.write(chalk.bold(`${items[choice]}\n\n`))
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  const nickname = await readLineRaw('暱稱：')
  if (!nickname) return false

  const pin = await readPinRaw('6 位 PIN：')
  if (pin === null) return false
  if (pin.length !== 6) {
    process.stdout.write(chalk.red('\nPIN 必須為 6 位數字\n'))
    process.stdout.write(chalk.dim('按任意鍵返回...\n'))
    await waitForKey()
    return false
  }

  try {
    clearScreen()
    process.stdout.write(chalk.dim('處理中...\n'))
    if (choice === 0) {
      await login(nickname, pin)
    } else {
      await register(nickname, pin)
    }
    process.stdout.write(chalk.green('✓ 登入成功\n'))
    process.stdout.write(chalk.dim('按任意鍵繼續...\n'))
    await waitForKey()
    return true
  } catch (err) {
    const msg = err instanceof NetworkError
      ? err.message
      : err instanceof AuthError
        ? '暱稱或 PIN 錯誤'
        : '發生錯誤，請稍後再試'
    process.stdout.write(chalk.red(`\n${msg}\n`))
    process.stdout.write(chalk.dim('按任意鍵返回...\n'))
    await waitForKey()
    return false
  }
}

async function runBrowse(): Promise<void> {
  clearScreen()
  process.stdout.write(chalk.dim('載入書卷列表...\n'))

  let books
  try {
    const res = await fetchBooks()
    books = res.books
  } catch (err) {
    process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '無法載入書卷'}\n`))
    process.stdout.write(chalk.dim('按任意鍵返回...\n'))
    await waitForKey()
    return
  }

  while (true) {
    const book = await showBooks(books)
    if (!book) return

    const chapterNum = await showChapterSelect(book)
    if (!chapterNum) continue

    clearScreen()
    process.stdout.write(chalk.dim('載入章節...\n'))

    let chapterData
    try {
      const res = await fetchChapter(book.id, chapterNum)
      chapterData = res.chapter
    } catch (err) {
      process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '無法載入章節'}\n`))
      process.stdout.write(chalk.dim('按任意鍵返回...\n'))
      await waitForKey()
      continue
    }

    let annotations: Annotation[] = []
    try {
      const res = await fetchAnnotations(book.id, chapterNum)
      annotations = res.annotations
    } catch {
      // Best effort — show chapter without annotation markers if not logged in
    }

    while (true) {
      const action = await showChapter(chapterData, annotations)
      if (!action) break

      // User pressed 'a' to annotate the selected verse
      clearScreen()
      showCursor()
      process.stdout.write(chalk.bold(`新增節次註記 — ${chapterData.book_name} ${chapterNum}:${action.verse}\n\n`))

      const note = await readLine('內容 (最多 1000 字)：')
      hideCursor()

      if (!note || note.trim() === '') continue

      if (note.length > 1000) {
        clearScreen()
        process.stdout.write(chalk.red('內容不能超過 1000 字\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
        continue
      }

      clearScreen()
      process.stdout.write(chalk.dim('儲存中...\n'))
      try {
        await createAnnotation({ book_id: book.id, chapter: chapterNum, verse: action.verse, note: note.trim() })
        const res = await fetchAnnotations(book.id, chapterNum)
        annotations = res.annotations
        process.stdout.write(chalk.green('✓ 註記已儲存\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        if (err instanceof AuthError) {
          process.stdout.write(chalk.yellow('請先登入才能新增註記\n'))
        } else {
          process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '無法儲存'}\n`))
        }
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      }
    }
  }
}

async function runSearch(): Promise<void> {
  while (true) {
    clearScreen()
    showCursor()
    process.stdout.write(chalk.bold('搜尋節次\n\n'))

    const keyword = await readLine('關鍵字（至少 2 個字，q 返回）：')
    hideCursor()

    if (keyword === null || keyword === 'q' || keyword === '') return
    if (keyword.length < 2) {
      clearScreen()
      process.stdout.write(chalk.red('關鍵字至少需要 2 個字\n'))
      process.stdout.write(chalk.dim('按任意鍵重試...\n'))
      await waitForKey()
      continue
    }

    clearScreen()
    process.stdout.write(chalk.dim(`搜尋「${keyword}」中...\n`))

    try {
      const res = await searchVerses(keyword)
      await showSearchResults(keyword, res.count, res.verses)
    } catch (err) {
      process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '搜尋失敗'}\n`))
      process.stdout.write(chalk.dim('按任意鍵返回...\n'))
      await waitForKey()
    }
  }
}

async function runPlans(): Promise<void> {
  if (!await ensureAuth()) return

  while (true) {
    clearScreen()
    process.stdout.write(chalk.dim('載入讀經計劃...\n'))

    let userPlans: UserPlan[]
    try {
      const res = await fetchUserPlans()
      userPlans = res.plans
    } catch (err) {
      process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '載入失敗'}\n`))
      process.stdout.write(chalk.dim('按任意鍵返回...\n'))
      await waitForKey()
      return
    }

    const action = await showUserPlanMenu(userPlans)
    if (!action) return

    if (action.type === 'new') {
      clearScreen()
      process.stdout.write(chalk.dim('載入可用計劃...\n'))

      let plans
      try {
        const res = await fetchPlans()
        plans = res.plans
      } catch (err) {
        process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '載入失敗'}\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
        continue
      }

      const plan = await showPlanSelect(plans)
      if (!plan) continue

      clearScreen()
      showCursor()
      process.stdout.write(chalk.bold(`開始讀經計劃：${plan.title}\n\n`))
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })
      const startDate = await readLine('開始日期 (YYYY-MM-DD)：', today)
      hideCursor()

      if (!startDate) continue

      clearScreen()
      process.stdout.write(chalk.dim('建立計劃...\n'))
      try {
        await startUserPlan(plan.id, startDate)
        process.stdout.write(chalk.green(`✓ 已開始「${plan.title}」\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '建立失敗'}\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      }
    } else {
      const up = action.plan

      while (true) {
        clearScreen()
        process.stdout.write(chalk.dim('載入今日進度...\n'))

        let todayData
        try {
          todayData = await fetchTodayReading(up.id)
        } catch (err) {
          process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '載入失敗'}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
          break
        }

        const result = await showTodayReading(todayData)
        if (result === 'back') break

        clearScreen()
        process.stdout.write(chalk.dim('記錄完成...\n'))
        try {
          const res = await markDayComplete(up.id, todayData.current_day)
          if (res.already_completed) {
            process.stdout.write(chalk.yellow('今日已記錄過完成\n'))
          } else {
            process.stdout.write(chalk.green(`✓ 第 ${todayData.current_day} 天完成！\n`))
          }
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        } catch (err) {
          process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '記錄失敗'}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        }
      }
    }
  }
}

async function runAnnotations(): Promise<void> {
  if (!await ensureAuth()) return

  while (true) {
    clearScreen()
    process.stdout.write(chalk.dim('載入節次註記...\n'))

    let annotations: Annotation[]
    try {
      const res = await fetchAnnotations()
      annotations = res.annotations
    } catch (err) {
      process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '載入失敗'}\n`))
      process.stdout.write(chalk.dim('按任意鍵返回...\n'))
      await waitForKey()
      return
    }

    const action = await showAnnotationList(annotations)
    if (!action) return

    if (action.type === 'delete') {
      clearScreen()
      process.stdout.write(chalk.dim('刪除中...\n'))
      try {
        await deleteAnnotation(action.id)
        process.stdout.write(chalk.green('✓ 已刪除\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '刪除失敗'}\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      }
    }
  }
}

const MENU_ITEMS = ['瀏覽書卷', '搜尋節次', '讀經計劃', '節次註記', '回上層'] as const
const TOTAL = MENU_ITEMS.length

export async function runBible(): Promise<void> {
  let selected = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('聖經閱讀\n\n'))
    MENU_ITEMS.forEach((label, i) => {
      if (i === TOTAL - 1) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }

  while (true) {
    render()
    const key = await waitForKey()

    if (key === 'q' || key === 'ctrl+c') break
    else if (key === 'up' || key === 'k') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down' || key === 'j') selected = (selected + 1) % TOTAL
    else if (key === 'enter') {
      showCursor()
      if (selected === 0) await runBrowse()
      else if (selected === 1) await runSearch()
      else if (selected === 2) await runPlans()
      else if (selected === 3) await runAnnotations()
      else break
      hideCursor()
    }
  }
}
