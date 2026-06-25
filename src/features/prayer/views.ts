import chalk from 'chalk'
import { clearScreen, hideCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import type { Book, Item, Entry } from './client.js'

export async function readLine(prompt: string, defaultValue?: string): Promise<string | null> {
  process.stdout.write(prompt)
  if (defaultValue !== undefined && defaultValue !== '') process.stdout.write(chalk.dim(` [${defaultValue}]`))
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

const RECURRENCE_LABELS: Record<string, string> = {
  once: '一次性',
  daily: '每日',
  weekly: '每週',
  monthly: '每月',
  custom: '自訂',
}

const RECURRENCE_OPTIONS = ['once', 'daily', 'weekly', 'monthly', 'custom'] as const

function formatPrayedAt(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit' })
  const time = d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} ${time}`
}

function nowLocalStr(): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function parseDateTime(input: string): string {
  const d = new Date(input.trim().replace(' ', 'T'))
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function listPageSize(overhead: number): number {
  return Math.max(3, (process.stdout.rows ?? 24) - overhead)
}

function wrapText(text: string, maxCols: number): string[] {
  const lines: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    lines.push(remaining.slice(0, maxCols))
    remaining = remaining.slice(maxCols)
  }
  return lines.length > 0 ? lines : ['']
}

// ─── Books ────────────────────────────────────────────────────────────────────

export type BookListResult =
  | { action: 'select'; index: number }
  | { action: 'new' }
  | { action: 'back' }

export async function showBookList(books: Book[]): Promise<BookListResult> {
  // overhead: header 2 + separator 1 + 新增 1 + 返回 1 + hint 2 = 7
  const OVERHEAD = 7
  const TOTAL = books.length + 2
  let selected = 0
  let viewOffset = 0

  const adjustView = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    if (selected < books.length) {
      if (selected < viewOffset) viewOffset = selected
      else if (selected >= viewOffset + PAGE) viewOffset = selected - PAGE + 1
      viewOffset = Math.max(0, Math.min(viewOffset, Math.max(0, books.length - PAGE)))
    }
  }

  const render = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('禱告日記 — 禱告本\n\n'))
    if (books.length === 0) {
      process.stdout.write(chalk.dim('    尚無禱告本\n'))
    } else {
      books.slice(viewOffset, viewOffset + PAGE).forEach((b, vi) => {
        const i = viewOffset + vi
        const desc = b.description ? chalk.dim(`  ${b.description}`) : ''
        process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${b.title}${desc}\n`) : `    ${b.title}${desc}\n`)
      })
    }
    process.stdout.write(`    ──────────\n`)
    process.stdout.write(books.length === selected ? chalk.cyan(`  ▶ [+ 新增禱告本]\n`) : `    [+ 新增禱告本]\n`)
    process.stdout.write(books.length + 1 === selected ? chalk.cyan(`  ▶ 返回\n`) : `    返回\n`)
    const counter = books.length > 0 && selected < books.length ? chalk.dim(`  (${selected + 1}/${books.length})`) : ''
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回') + counter + '\n')
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') { selected = (selected - 1 + TOTAL) % TOTAL; adjustView() }
    else if (key === 'down') { selected = (selected + 1) % TOTAL; adjustView() }
    else if (key === 'q' || key === 'ctrl+c') return { action: 'back' }
    else if (key === 'enter') {
      if (selected < books.length) return { action: 'select', index: selected }
      if (selected === books.length) return { action: 'new' }
      return { action: 'back' }
    }
  }
}

export interface BookFormData {
  title: string
  description: string
}

export async function showBookForm(existing?: { title?: string; description?: string | null }): Promise<BookFormData | null> {
  clearScreen()
  process.stdout.write(chalk.bold(`${existing?.title ? '編輯' : '新增'}禱告本\n\n`))
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  const title = await readLine('名稱：', existing?.title)
  if (title === null || title.trim() === '') return null

  const description = await readLine('說明（可空白）：', existing?.description ?? undefined)
  if (description === null) return null

  return { title: title.trim(), description: description.trim() }
}

export type BookMenuAction = 'entries' | 'add-entry' | 'edit' | 'delete' | 'back'

export async function showBookMenu(book: Book): Promise<BookMenuAction> {
  type MenuItem = { label: string; action: BookMenuAction; sep?: boolean }
  const items: MenuItem[] = [
    { label: '查看禱告記錄', action: 'entries' },
    { label: '新增禱告記錄', action: 'add-entry' },
    { label: '編輯禱告本', action: 'edit', sep: true },
    { label: '刪除禱告本', action: 'delete' },
    { label: '返回', action: 'back' },
  ]
  const TOTAL = items.length
  let selected = 0

  const render = (): void => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`${book.title}\n`))
    if (book.description) process.stdout.write(chalk.dim(`${book.description}\n`))
    process.stdout.write('\n')
    items.forEach((m, i) => {
      if (m.sep) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${m.label}\n`) : `    ${m.label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down') selected = (selected + 1) % TOTAL
    else if (key === 'q' || key === 'ctrl+c') return 'back'
    else if (key === 'enter') return items[selected].action
  }
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export type EntriesListResult =
  | { action: 'select'; index: number }
  | { action: 'new' }
  | { action: 'back' }

export async function showEntriesList(entries: Entry[], bookTitle: string): Promise<EntriesListResult> {
  // overhead: header 2 + separator 1 + 新增 1 + 返回 1 + hint 2 = 7
  const OVERHEAD = 7
  const TOTAL = entries.length + 2
  let selected = 0
  let viewOffset = 0

  const formatEntry = (e: Entry): string => {
    const time = formatPrayedAt(e.prayed_at)
    const maxLen = Math.max(10, (process.stdout.columns ?? 80) - time.length - 6)
    const content = e.content
      ? (e.content.length > maxLen ? e.content.slice(0, maxLen - 1) + '…' : e.content)
      : chalk.dim('（無內容）')
    return `${time}  ${content}`
  }

  const adjustView = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    if (selected < entries.length) {
      if (selected < viewOffset) viewOffset = selected
      else if (selected >= viewOffset + PAGE) viewOffset = selected - PAGE + 1
      viewOffset = Math.max(0, Math.min(viewOffset, Math.max(0, entries.length - PAGE)))
    }
  }

  const render = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`${bookTitle} — 禱告記錄\n\n`))
    if (entries.length === 0) {
      process.stdout.write(chalk.dim('    尚無記錄\n'))
    } else {
      entries.slice(viewOffset, viewOffset + PAGE).forEach((e, vi) => {
        const i = viewOffset + vi
        process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${formatEntry(e)}\n`) : `    ${formatEntry(e)}\n`)
      })
    }
    process.stdout.write(`    ──────────\n`)
    process.stdout.write(entries.length === selected ? chalk.cyan(`  ▶ [+ 新增記錄]\n`) : `    [+ 新增記錄]\n`)
    process.stdout.write(entries.length + 1 === selected ? chalk.cyan(`  ▶ 返回\n`) : `    返回\n`)
    const counter = entries.length > 0 && selected < entries.length ? chalk.dim(`  (${selected + 1}/${entries.length})`) : ''
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回') + counter + '\n')
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') { selected = (selected - 1 + TOTAL) % TOTAL; adjustView() }
    else if (key === 'down') { selected = (selected + 1) % TOTAL; adjustView() }
    else if (key === 'q' || key === 'ctrl+c') return { action: 'back' }
    else if (key === 'enter') {
      if (selected < entries.length) return { action: 'select', index: selected }
      if (selected === entries.length) return { action: 'new' }
      return { action: 'back' }
    }
  }
}

export interface EntryFormData {
  content: string
  prayed_at: string
  item_ids: string[]
}

export async function showAddEntryForm(items: Item[]): Promise<EntryFormData | null> {
  clearScreen()
  process.stdout.write(chalk.bold('新增禱告記錄\n\n'))
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  const content = await readLine('禱告內容（可空白）：')
  if (content === null) return null

  const timeStr = await readLine('禱告時間 (YYYY-MM-DD HH:MM)：', nowLocalStr())
  if (timeStr === null) return null

  const prayed_at = parseDateTime(timeStr)

  let item_ids: string[] = []
  if (items.length > 0) {
    const ids = await showItemCheckList(items)
    if (ids === null) return null
    item_ids = ids
  }

  return { content: content.trim(), prayed_at, item_ids }
}

async function showItemCheckList(items: Item[]): Promise<string[] | null> {
  // overhead: header 2 + separator 1 + 確認 1 + 略過 1 + hint 2 = 7
  const OVERHEAD = 7
  const checked = new Set<number>()
  const TOTAL = items.length + 2
  let cursor = 0
  let viewOffset = 0

  const adjustView = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    if (cursor < items.length) {
      if (cursor < viewOffset) viewOffset = cursor
      else if (cursor >= viewOffset + PAGE) viewOffset = cursor - PAGE + 1
      viewOffset = Math.max(0, Math.min(viewOffset, Math.max(0, items.length - PAGE)))
    }
  }

  const render = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('連結禱告事項（可略過）\n\n'))
    items.slice(viewOffset, viewOffset + PAGE).forEach((item, vi) => {
      const i = viewOffset + vi
      const check = checked.has(i) ? chalk.green('[✓]') : '[ ]'
      const recLabel = chalk.dim(RECURRENCE_LABELS[item.recurrence] ?? item.recurrence)
      process.stdout.write(i === cursor
        ? chalk.cyan(`  ▶ ${check} ${item.title}  ${recLabel}\n`)
        : `    ${check} ${item.title}  ${recLabel}\n`)
    })
    process.stdout.write(`    ──────────\n`)
    process.stdout.write(items.length === cursor ? chalk.cyan(`  ▶ 確認選擇\n`) : `    確認選擇\n`)
    process.stdout.write(items.length + 1 === cursor ? chalk.cyan(`  ▶ 略過（不連結）\n`) : `    略過（不連結）\n`)
    const counter = items.length > 0 && cursor < items.length ? chalk.dim(`  (${cursor + 1}/${items.length})`) : ''
    process.stdout.write(chalk.dim('\n↑↓ 移動  Space 勾選  Enter 確認  q 取消') + counter + '\n')
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'ctrl+c') return null
    else if (key === 'q') return []
    else if (key === 'up') { cursor = (cursor - 1 + TOTAL) % TOTAL; adjustView() }
    else if (key === 'down') { cursor = (cursor + 1) % TOTAL; adjustView() }
    else if (key === 'space' && cursor < items.length) {
      if (checked.has(cursor)) checked.delete(cursor)
      else checked.add(cursor)
    }
    else if (key === 'enter') {
      if (cursor === items.length) return items.filter((_, i) => checked.has(i)).map((item) => item.id)
      if (cursor === items.length + 1) return []
    }
  }
}

export async function showEntryDetail(entry: Entry, bookTitle: string): Promise<'delete' | 'back'> {
  const render = (): void => {
    const cols = process.stdout.columns ?? 80
    // header 1 + time 1 + blank 1 + hint 1 = 4 fixed; items section adds ~2 + count
    const itemLines = entry.items && entry.items.length > 0 ? entry.items.length + 2 : 0
    const availableForContent = Math.max(1, (process.stdout.rows ?? 24) - 4 - itemLines)

    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold(`${bookTitle} — 禱告記錄\n`))
    process.stdout.write(chalk.dim(`${formatPrayedAt(entry.prayed_at)}\n\n`))

    if (entry.content) {
      const lines = wrapText(entry.content, cols - 2)
      lines.slice(0, availableForContent).forEach((line) => process.stdout.write(`${line}\n`))
      if (lines.length > availableForContent) process.stdout.write(chalk.dim(`…（${lines.length - availableForContent} 行省略）\n`))
    } else {
      process.stdout.write(chalk.dim('（無內容）\n'))
    }

    if (entry.items && entry.items.length > 0) {
      process.stdout.write('\n連結禱告事項：\n')
      entry.items.forEach((item) => {
        const check = item.is_answered ? chalk.green('[✓]') : '[ ]'
        process.stdout.write(`  ${check} ${item.title}  ${chalk.dim(RECURRENCE_LABELS[item.recurrence] ?? item.recurrence)}\n`)
      })
    }

    process.stdout.write(chalk.dim('\nd 刪除  q 返回\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'enter') return 'back'
    if (key === 'd') {
      clearScreen()
      process.stdout.write(chalk.yellow('確認刪除此記錄？Enter 確認，其他鍵取消\n'))
      const confirm = await waitForKey()
      if (confirm === 'enter') return 'delete'
    }
  }
}

// ─── Items ────────────────────────────────────────────────────────────────────

export type ItemListResult =
  | { action: 'select'; index: number }
  | { action: 'new' }
  | { action: 'toggle-filter' }
  | { action: 'back' }

export async function showItemList(items: Item[], isArchived: boolean): Promise<ItemListResult> {
  // overhead: header 2 + separator 1 + 新增 1 + 顯示封存 1 + 返回 1 + hint 2 = 8
  const OVERHEAD = 8
  const TOTAL = items.length + 3
  let selected = 0
  let viewOffset = 0
  const filterLabel = isArchived ? '顯示未封存' : '顯示已封存'

  const adjustView = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    if (selected < items.length) {
      if (selected < viewOffset) viewOffset = selected
      else if (selected >= viewOffset + PAGE) viewOffset = selected - PAGE + 1
      viewOffset = Math.max(0, Math.min(viewOffset, Math.max(0, items.length - PAGE)))
    }
  }

  const render = (): void => {
    const PAGE = listPageSize(OVERHEAD)
    clearScreen()
    hideCursor()
    const title = isArchived ? '禱告事項（已封存）' : '禱告事項'
    process.stdout.write(chalk.bold(`禱告日記 — ${title}\n\n`))
    if (items.length === 0) {
      process.stdout.write(chalk.dim('    尚無事項\n'))
    } else {
      items.slice(viewOffset, viewOffset + PAGE).forEach((item, vi) => {
        const i = viewOffset + vi
        const check = item.is_answered ? chalk.green('[✓]') : '[ ]'
        const recLabel = chalk.dim(RECURRENCE_LABELS[item.recurrence] ?? item.recurrence)
        process.stdout.write(i === selected
          ? chalk.cyan(`  ▶ ${check} ${item.title}  ${recLabel}\n`)
          : `    ${check} ${item.title}  ${recLabel}\n`)
      })
    }
    process.stdout.write(`    ──────────\n`)
    process.stdout.write(items.length === selected ? chalk.cyan(`  ▶ [+ 新增事項]\n`) : `    [+ 新增事項]\n`)
    process.stdout.write(items.length + 1 === selected ? chalk.cyan(`  ▶ ${filterLabel}\n`) : `    ${filterLabel}\n`)
    process.stdout.write(items.length + 2 === selected ? chalk.cyan(`  ▶ 返回\n`) : `    返回\n`)
    const counter = items.length > 0 && selected < items.length ? chalk.dim(`  (${selected + 1}/${items.length})`) : ''
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回') + counter + '\n')
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') { selected = (selected - 1 + TOTAL) % TOTAL; adjustView() }
    else if (key === 'down') { selected = (selected + 1) % TOTAL; adjustView() }
    else if (key === 'q' || key === 'ctrl+c') return { action: 'back' }
    else if (key === 'enter') {
      if (selected < items.length) return { action: 'select', index: selected }
      if (selected === items.length) return { action: 'new' }
      if (selected === items.length + 1) return { action: 'toggle-filter' }
      return { action: 'back' }
    }
  }
}

export type ItemMenuAction = 'toggle-answer' | 'toggle-archive' | 'edit' | 'delete' | 'back'

export async function showItemMenu(item: Item): Promise<ItemMenuAction> {
  type MenuItem = { label: string; action: ItemMenuAction; sep?: boolean }
  const menuItems: MenuItem[] = [
    { label: item.is_answered ? '取消應允' : '標記已應允', action: 'toggle-answer' },
    { label: item.is_archived ? '取消封存' : '封存', action: 'toggle-archive' },
    { label: '編輯', action: 'edit' },
    { label: '刪除', action: 'delete', sep: true },
    { label: '返回', action: 'back' },
  ]
  const TOTAL = menuItems.length
  let selected = 0

  const render = (): void => {
    const cols = process.stdout.columns ?? 80
    clearScreen()
    hideCursor()
    const answeredStr = item.is_answered ? chalk.green('已應允') : chalk.dim('未應允')
    const archivedStr = item.is_archived ? `  ${chalk.dim('已封存')}` : ''
    process.stdout.write(chalk.bold(`${item.title}\n`))
    process.stdout.write(`${RECURRENCE_LABELS[item.recurrence] ?? item.recurrence}  ${answeredStr}${archivedStr}\n`)
    if (item.content) {
      process.stdout.write('\n')
      wrapText(item.content, cols - 2).forEach((line) => process.stdout.write(chalk.dim(`${line}\n`)))
    }
    process.stdout.write('\n')
    menuItems.forEach((m, i) => {
      if (m.sep) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${m.label}\n`) : `    ${m.label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down') selected = (selected + 1) % TOTAL
    else if (key === 'q' || key === 'ctrl+c') return 'back'
    else if (key === 'enter') return menuItems[selected].action
  }
}

export interface ItemFormData {
  title: string
  content: string
  recurrence: string
}

export async function showItemForm(existing?: Partial<Item>): Promise<ItemFormData | null> {
  clearScreen()
  process.stdout.write(chalk.bold(`${existing?.title ? '編輯' : '新增'}禱告事項\n\n`))
  process.stdout.write(chalk.dim('每個步驟按 Ctrl+C 取消\n\n'))

  const title = await readLine('標題：', existing?.title)
  if (title === null || title.trim() === '') return null

  const content = await readLine('詳細內容（可空白）：', existing?.content ?? undefined)
  if (content === null) return null

  const recurrence = await selectRecurrence(existing?.recurrence ?? 'once')
  if (recurrence === null) return null

  return { title: title.trim(), content: content.trim(), recurrence }
}

async function selectRecurrence(defaultValue: string): Promise<string | null> {
  let selected = RECURRENCE_OPTIONS.indexOf(defaultValue as typeof RECURRENCE_OPTIONS[number])
  if (selected === -1) selected = 0
  const TOTAL = RECURRENCE_OPTIONS.length

  const render = (): void => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('選擇週期\n\n'))
    RECURRENCE_OPTIONS.forEach((opt, i) => {
      process.stdout.write(i === selected
        ? chalk.cyan(`  ▶ ${RECURRENCE_LABELS[opt]}\n`)
        : `    ${RECURRENCE_LABELS[opt]}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 取消\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()
    if (key === 'up') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down') selected = (selected + 1) % TOTAL
    else if (key === 'q' || key === 'ctrl+c') return null
    else if (key === 'enter') return RECURRENCE_OPTIONS[selected]
  }
}
