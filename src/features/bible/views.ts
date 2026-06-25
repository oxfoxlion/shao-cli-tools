import chalk from 'chalk'
import { clearScreen, hideCursor } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import type { Book, BibleChapter, Annotation, Plan, UserPlan, SearchVerseResult, TodayReadingResponse } from './client.js'

export async function readLine(prompt: string, defaultValue?: string): Promise<string | null> {
  process.stdout.write(prompt)
  if (defaultValue !== undefined) process.stdout.write(chalk.dim(` [${defaultValue}]`))
  process.stdout.write(' ')
  return new Promise((resolve) => {
    let buf = ''
    const onData = (data: string) => {
      if (data === '\r' || data === '\n') {
        process.stdin.off('data', onData)
        process.stdout.write('\n')
        resolve(buf.trim() !== '' ? buf.trim() : (defaultValue ?? ''))
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

export async function showBooks(books: Book[]): Promise<Book | null> {
  type DisplayRow = { selectable: false; label: string } | { selectable: true; book: Book }
  const rows: DisplayRow[] = []
  let testament = ''
  for (const book of books) {
    if (book.testament !== testament) {
      testament = book.testament
      rows.push({ selectable: false, label: `── ${book.testament === 'old' ? '舊約' : '新約'} ──` })
    }
    rows.push({ selectable: true, book })
  }

  const totalBooks = books.length
  let selected = 0

  function rowIndexOf(bookIdx: number): number {
    let count = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].selectable) {
        count++
        if (count === bookIdx) return i
      }
    }
    return 0
  }

  const ps = Math.max(5, (process.stdout.rows ?? 24) - 6)

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('聖經閱讀 — 選擇書卷\n\n'))

    const centerRow = rowIndexOf(selected)
    const viewStart = Math.max(0, Math.min(centerRow - Math.floor(ps / 2), rows.length - ps))
    const viewEnd = Math.min(rows.length, viewStart + ps)

    let bookIdx = 0
    for (let i = 0; i < viewStart; i++) {
      if (rows[i].selectable) bookIdx++
    }

    for (let i = viewStart; i < viewEnd; i++) {
      const row = rows[i]
      if (!row.selectable) {
        process.stdout.write(chalk.dim(`  ${row.label}\n`))
      } else {
        const isSelected = bookIdx === selected
        const b = row.book
        process.stdout.write(
          isSelected
            ? chalk.cyan(`  ▶ ${b.name}`) + chalk.dim(` ${b.chapters}章\n`)
            : `    ${b.name}` + chalk.dim(` ${b.chapters}章\n`)
        )
        bookIdx++
      }
    }

    process.stdout.write(chalk.dim(`\nj/k ↑↓ 移動  Enter 選擇  q 返回  (${selected + 1}/${totalBooks})\n`))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c') return null
    if ((key === 'up' || key === 'k') && selected > 0) { selected--; render() }
    if ((key === 'down' || key === 'j') && selected < totalBooks - 1) { selected++; render() }
    if (key === 'enter') return books[selected]
  }
}

export async function showChapterSelect(book: Book): Promise<number | null> {
  const total = book.chapters
  let selected = 0
  const COLS = 10

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`${book.name} — 選擇章節\n\n`))

    for (let i = 0; i < total; i++) {
      const chap = i + 1
      const cell = String(chap)
      process.stdout.write(i === selected ? chalk.cyan(`[${cell}]`.padEnd(6)) : cell.padEnd(6))
      if ((i + 1) % COLS === 0 || i === total - 1) process.stdout.write('\n')
    }

    process.stdout.write(chalk.dim('\n← → ↑↓ 移動  Enter 選擇  q 返回\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if (key === 'left' && selected > 0) { selected--; render() }
    if (key === 'right' && selected < total - 1) { selected++; render() }
    if ((key === 'up' || key === 'k') && selected - COLS >= 0) { selected -= COLS; render() }
    if ((key === 'down' || key === 'j') && selected + COLS < total) { selected += COLS; render() }
    if (key === 'enter') return selected + 1
  }
}

export async function showChapter(
  chapter: BibleChapter,
  annotations: Annotation[]
): Promise<{ type: 'annotate'; verse: number } | null> {
  const verses = chapter.verses
  const annotatedVerses = new Set(
    annotations
      .filter(a => a.book_id === chapter.book_id && a.chapter === chapter.chapter)
      .map(a => a.verse)
  )
  const ps = Math.max(3, (process.stdout.rows ?? 24) - 5)
  let cursor = 0
  let offset = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`${chapter.book_name} 第 ${chapter.chapter} 章\n\n`))

    for (let i = offset; i < Math.min(offset + ps, verses.length); i++) {
      const v = verses[i]
      const isSelected = i === cursor
      const numStr = String(v.verse).padStart(3)
      const annMark = annotatedVerses.has(v.verse) ? chalk.yellow('✎') : ' '
      if (isSelected) {
        process.stdout.write(chalk.cyan(`▶ ${numStr} `) + annMark + chalk.cyan(` ${v.text}\n`))
      } else {
        process.stdout.write(` ${chalk.dim(numStr)} ${annMark} ${v.text}\n`)
      }
    }

    process.stdout.write(chalk.dim(`\nj/k 移動  a 新增註記  q 返回  (${cursor + 1}/${verses.length})\n`))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if (key === 'a') return { type: 'annotate', verse: verses[cursor].verse }
    if ((key === 'up' || key === 'k') && cursor > 0) {
      cursor--
      if (cursor < offset) offset = cursor
      render()
    }
    if ((key === 'down' || key === 'j') && cursor < verses.length - 1) {
      cursor++
      if (cursor >= offset + ps) offset = cursor - ps + 1
      render()
    }
  }
}

export async function showSearchResults(
  keyword: string,
  count: number,
  verses: SearchVerseResult[]
): Promise<void> {
  if (count === 0) {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`搜尋「${keyword}」\n\n`))
    process.stdout.write(chalk.dim('找不到相關節次\n\n'))
    process.stdout.write(chalk.dim('q 返回\n'))
    while (true) {
      const key = await waitForKey()
      if (key === 'q' || key === 'ctrl+c' || key === 'enter' || key === 'escape') return
    }
  }

  const resultsPerPage = Math.max(1, Math.floor(((process.stdout.rows ?? 24) - 6) / 3))
  let offset = 0

  const render = () => {
    clearScreen()
    hideCursor()
    const shown = verses.length < count ? `顯示前 ${verses.length} 筆，共 ${count} 筆` : `共 ${count} 筆`
    process.stdout.write(chalk.bold(`搜尋「${keyword}」— ${shown}\n\n`))

    for (const v of verses.slice(offset, offset + resultsPerPage)) {
      process.stdout.write(`  ${chalk.cyan(`${v.book_name} ${v.chapter}:${v.verse}`)}\n`)
      process.stdout.write(`  ${v.text}\n\n`)
    }

    process.stdout.write(chalk.dim(`j/k 滾動  q 返回\n`))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return
    if ((key === 'down' || key === 'j') && offset + resultsPerPage < verses.length) { offset++; render() }
    if ((key === 'up' || key === 'k') && offset > 0) { offset--; render() }
  }
}

export async function showPlanSelect(plans: Plan[]): Promise<Plan | null> {
  let selected = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('選擇讀經計劃\n\n'))
    plans.forEach((plan, i) => {
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${plan.title}`) + chalk.dim(` (${plan.total_days}天)\n`))
        process.stdout.write(`    ${chalk.dim(plan.description)}\n\n`)
      } else {
        process.stdout.write(`    ${plan.title}` + chalk.dim(` (${plan.total_days}天)\n\n`))
      }
    })
    process.stdout.write(chalk.dim('↑↓ 移動  Enter 確認  q 返回\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if ((key === 'up' || key === 'k') && selected > 0) { selected--; render() }
    if ((key === 'down' || key === 'j') && selected < plans.length - 1) { selected++; render() }
    if (key === 'enter') return plans[selected]
  }
}

export type UserPlanMenuResult = { type: 'view'; plan: UserPlan } | { type: 'new' }

export async function showUserPlanMenu(userPlans: UserPlan[]): Promise<UserPlanMenuResult | null> {
  const total = userPlans.length + 1
  let selected = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('我的讀經計劃\n\n'))

    userPlans.forEach((up, i) => {
      const status = up.is_active ? chalk.green('進行中') : chalk.dim('已暫停')
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${up.plan.title}`) + `  ${status}\n`)
        process.stdout.write(`    開始：${up.start_date}  共 ${up.plan.total_days} 天\n\n`)
      } else {
        process.stdout.write(`    ${up.plan.title}  ${status}\n    開始：${up.start_date}\n\n`)
      }
    })

    if (userPlans.length > 0) process.stdout.write(`    ──────────\n`)
    process.stdout.write(
      userPlans.length === selected
        ? chalk.cyan(`  ▶ ＋ 開始新計劃\n`)
        : `    ＋ 開始新計劃\n`
    )

    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if ((key === 'up' || key === 'k') && selected > 0) { selected--; render() }
    if ((key === 'down' || key === 'j') && selected < total - 1) { selected++; render() }
    if (key === 'enter') {
      if (selected === userPlans.length) return { type: 'new' }
      return { type: 'view', plan: userPlans[selected] }
    }
  }
}

export async function showTodayReading(data: TodayReadingResponse): Promise<'complete' | 'back'> {
  const { current_day, total_days, reading, completed_days } = data
  const isCompleted = completed_days.includes(current_day)
  const isFinished = current_day > total_days

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('今日讀經\n\n'))

    if (isFinished) {
      process.stdout.write(chalk.green(`恭喜！計劃已全部完成（${total_days} 天）\n\n`))
    } else {
      process.stdout.write(`第 ${chalk.cyan(String(current_day))} 天 / 共 ${total_days} 天\n\n`)
    }

    process.stdout.write(`今日閱讀：\n`)
    reading.passages.forEach((p) => {
      process.stdout.write(`  ${p.book_name} 第 ${p.chapter} 章\n`)
    })

    const pct = Math.floor((completed_days.length / total_days) * 100)
    process.stdout.write(`\n已完成：${completed_days.length}/${total_days} 天 (${pct}%)\n`)

    if (isCompleted) {
      process.stdout.write(chalk.green('\n✓ 今日已完成\n'))
    } else if (!isFinished) {
      process.stdout.write(chalk.dim('\nEnter 標記今日完成\n'))
    }
    process.stdout.write(chalk.dim('\nq 返回\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return 'back'
    if (key === 'enter' && !isCompleted && !isFinished) return 'complete'
  }
}

export async function showAnnotationList(
  annotations: Annotation[]
): Promise<{ type: 'delete'; id: string } | null> {
  if (annotations.length === 0) {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('我的節次註記\n\n'))
    process.stdout.write(chalk.dim('尚無任何註記\n\n'))
    process.stdout.write(chalk.dim('在閱讀章節時按 a 可新增註記\n\n'))
    process.stdout.write(chalk.dim('q 返回\n'))
    while (true) {
      const key = await waitForKey()
      if (key === 'q' || key === 'ctrl+c' || key === 'enter' || key === 'escape') return null
    }
  }

  const total = annotations.length
  let selected = 0
  const itemHeight = 3
  const ps = Math.max(1, Math.floor(((process.stdout.rows ?? 24) - 6) / itemHeight))

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`我的節次註記 (${total})\n\n`))

    const viewStart = Math.max(0, Math.min(selected - Math.floor(ps / 2), total - ps))
    const viewEnd = Math.min(total, viewStart + ps)

    for (let i = viewStart; i < viewEnd; i++) {
      const a = annotations[i]
      const ref = `${a.book_id} ${a.chapter}:${a.verse}`
      const preview = a.note.length > 50 ? a.note.slice(0, 47) + '...' : a.note
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${ref}\n    ${a.note}\n\n`))
      } else {
        process.stdout.write(`    ${chalk.dim(ref)}\n    ${preview}\n\n`)
      }
    }

    process.stdout.write(chalk.dim('↑↓ 移動  d 刪除  q 返回\n'))
  }

  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if ((key === 'up' || key === 'k') && selected > 0) { selected--; render() }
    if ((key === 'down' || key === 'j') && selected < total - 1) { selected++; render() }
    if (key === 'd') return { type: 'delete', id: annotations[selected].id }
  }
}
