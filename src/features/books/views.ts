import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import type { BookSummary } from './client.js'

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

export type SearchAction =
  | { type: 'select'; book: BookSummary }
  | { type: 'page'; direction: 1 | -1 }
  | null

export async function showSearchResults(
  results: BookSummary[],
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
  const ps = Math.max(3, (process.stdout.rows ?? 24) - 6)

  const render = () => {
    clearScreen()
    hideCursor()
    const pageLabel = hasNext || page > 1 ? chalk.dim(` 第 ${page} 頁`) : ''
    process.stdout.write(chalk.bold(`搜尋結果`) + pageLabel + chalk.dim(`（共 ${count} 筆）\n\n`))

    const viewStart = Math.max(0, Math.min(selected - Math.floor(ps / 2), total - ps))
    const viewEnd = Math.min(total, viewStart + ps)

    for (let i = viewStart; i < viewEnd; i++) {
      const b = results[i]
      const authors = b.authors.join(', ')
      const lang = chalk.dim(`[${b.languages.join(',')}]`)
      const noText = b.hasText ? '' : chalk.dim(' (無文字版)')
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${b.title}`) + noText + `\n`)
        process.stdout.write(chalk.dim(`    ${authors} ${lang}\n\n`))
      } else {
        process.stdout.write(`    ${b.title}` + noText + `\n`)
        process.stdout.write(chalk.dim(`    ${authors} ${lang}\n\n`))
      }
    }

    const hints: string[] = ['j/k ↑↓ 移動', 'Enter 選擇']
    if (page > 1) hints.push('p 上一頁')
    if (hasNext) hints.push('n 下一頁')
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

export async function showContent(
  title: string,
  lines: string[],
  page: number,
  totalPages: number,
): Promise<'next' | 'quit'> {
  let offset = 0
  const windowSize = Math.max(5, (process.stdout.rows ?? 24) - 4)
  const atLastPage = page >= totalPages

  const render = () => {
    clearScreen()
    hideCursor()
    const pageLabel = chalk.dim(` 第 ${page} / ${totalPages} 頁`)
    process.stdout.write(chalk.bold(title.length > 40 ? title.slice(0, 39) + '…' : title) + pageLabel + '\n\n')

    const end = Math.min(offset + windowSize, lines.length)
    for (let i = offset; i < end; i++) {
      process.stdout.write(lines[i] + '\n')
    }

    const atEnd = offset + windowSize >= lines.length
    const hints: string[] = ['j/k 滾動']
    if (atEnd && !atLastPage) hints.push('n 下一頁')
    if (atEnd && atLastPage) hints.push(chalk.green('全書完畢'))
    hints.push('q 返回')
    process.stdout.write(chalk.dim(`\n${hints.join('  ')}  (行 ${offset + 1}–${end}/${lines.length})\n`))
  }
  registerRender(render)
  render()

  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c' || key === 'escape') return 'quit'

    const atEnd = offset + windowSize >= lines.length

    if ((key === 'down' || key === 'j') && !atEnd) { offset++; render(); continue }
    if ((key === 'up' || key === 'k') && offset > 0) { offset--; render(); continue }

    if (key === 'n' && atEnd && !atLastPage) return 'next'

    // Space / PageDown: jump a full window
    if (key === 'space') {
      if (!atEnd) { offset = Math.min(offset + windowSize, lines.length - windowSize); render() }
      else if (!atLastPage) return 'next'
    }
  }
}

export async function showNoText(title: string): Promise<void> {
  clearScreen()
  hideCursor()
  process.stdout.write(chalk.bold(title) + '\n\n')
  process.stdout.write(chalk.yellow('此書沒有可用的純文字版本\n\n'))
  process.stdout.write(chalk.dim('按任意鍵返回...\n'))
  registerRender(() => {})
  await waitForKey()
}
