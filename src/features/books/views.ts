import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import type { GutendexBook } from './client.js'
import { getTextUrl } from './client.js'

export function readLine(prompt: string, defaultValue?: string): Promise<string | null> {
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

function formatAuthor(authors: GutendexBook['authors']): string {
  return authors.map(a => a.name.replace(/,\s*/, ' ')).join(', ')
}

export type SearchAction =
  | { type: 'select'; book: GutendexBook }
  | { type: 'page'; direction: 1 | -1 }
  | null

export async function showSearchResults(
  results: GutendexBook[],
  count: number,
  page: number,
  hasNext: boolean,
): Promise<SearchAction> {
  if (results.length === 0) {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('搜尋結果\n\n'))
    process.stdout.write(chalk.dim('找不到書籍\n\n'))
    process.stdout.write(chalk.dim('q 返回\n'))
    registerRender(() => {})
    while (true) {
      const key = await waitForKey()
      if (key === 'q' || key === 'ctrl+c' || key === 'escape' || key === 'enter') return null
    }
  }

  const total = results.length
  let selected = 0
  const ps = Math.max(3, Math.floor(((process.stdout.rows ?? 24) - 5) / 2))

  const render = () => {
    clearScreen()
    hideCursor()
    const pageLabel = hasNext || page > 1 ? chalk.dim(` 第 ${page} 頁`) : ''
    process.stdout.write(chalk.bold('搜尋結果') + pageLabel + chalk.dim(`（共 ${count} 筆）\n\n`))

    const viewStart = Math.max(0, Math.min(selected - Math.floor(ps / 2), total - ps))
    const viewEnd = Math.min(total, viewStart + ps)

    for (let i = viewStart; i < viewEnd; i++) {
      const b = results[i]
      const author = formatAuthor(b.authors)
      const lang = chalk.dim(`[${b.languages.join(',')}]`)
      const noText = getTextUrl(b.formats) === null ? chalk.dim(' (無文字版)') : ''
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${b.title}`) + noText + '\n')
        process.stdout.write(chalk.dim(`    ${author} ${lang}\n\n`))
      } else {
        process.stdout.write(`    ${b.title}` + noText + '\n')
        process.stdout.write(chalk.dim(`    ${author} ${lang}\n\n`))
      }
    }

    const hints = ['j/k 移動', 'Enter 選擇']
    if (page > 1) hints.push('p 上頁')
    if (hasNext) hints.push('n 下頁')
    hints.push('q 返回')
    process.stdout.write(chalk.dim(hints.join('  ') + '\n'))
  }
  registerRender(render)
  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if ((key === 'up' || key === 'k') && selected > 0) { selected--; render() }
    if ((key === 'down' || key === 'j') && selected < total - 1) { selected++; render() }
    if (key === 'n' && hasNext) return { type: 'page', direction: 1 }
    if (key === 'p' && page > 1) return { type: 'page', direction: -1 }
    if (key === 'enter') return { type: 'select', book: results[selected] }
  }
}

export async function showBookDetail(book: GutendexBook): Promise<'read' | null> {
  const textUrl = getTextUrl(book.formats)
  const canRead = textUrl !== null

  const render = () => {
    clearScreen()
    hideCursor()
    const cols = process.stdout.columns ?? 80
    process.stdout.write(chalk.bold(book.title) + '\n\n')
    process.stdout.write(`作者：${formatAuthor(book.authors)}\n`)
    process.stdout.write(`語言：${book.languages.join(', ')}\n`)
    if (book.subjects.length > 0) {
      const sub = book.subjects.slice(0, 3).join(' · ')
      const more = book.subjects.length > 3 ? ` …等 ${book.subjects.length} 個` : ''
      const preview = (sub + more).length > cols - 5 ? (sub + more).slice(0, cols - 8) + '…' : sub + more
      process.stdout.write(`主題：${preview}\n`)
    }
    process.stdout.write('\n')

    if (canRead) {
      process.stdout.write(chalk.dim('Enter 開始閱讀  q 返回\n'))
    } else {
      process.stdout.write(chalk.yellow('此書無純文字版本\n\n'))
      process.stdout.write(chalk.dim('q 返回\n'))
    }
  }
  registerRender(render)
  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return null
    if (key === 'enter' && canRead) return 'read'
  }
}
