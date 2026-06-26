import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { searchBooks, getBook, fetchLines, getTextUrl } from './client.js'
import { readLine, showSearchResults, showBookDetail } from './views.js'
import { runReader } from './reader.js'

async function handleError(err: unknown): Promise<void> {
  clearScreen()
  process.stdout.write(chalk.red(`\n錯誤：${err instanceof Error ? err.message : '發生未預期錯誤'}\n`))
  process.stdout.write(chalk.dim('按任意鍵返回...\n'))
  await waitForKey()
}

async function runSearch(): Promise<void> {
  while (true) {
    clearScreen()
    showCursor()
    process.stdout.write(chalk.bold('書庫 — 搜尋\n\n'))
    process.stdout.write(chalk.dim('輸入書名或作者（Ctrl+C 返回）\n\n'))

    const keyword = await readLine('關鍵字：')
    hideCursor()

    if (keyword === null || keyword.trim() === '') return

    let searchPage = 1

    searchLoop: while (true) {
      clearScreen()
      process.stdout.write(chalk.dim(`搜尋「${keyword}」中...\n`))

      let res
      try {
        res = await searchBooks(keyword.trim(), undefined, searchPage)
      } catch (err) {
        await handleError(err)
        break
      }

      const action = await showSearchResults(res.results, res.count, searchPage, res.next !== null)

      if (!action) break
      if (action.type === 'page') { searchPage += action.direction; continue }

      // action.type === 'select' — 取得書籍詳情
      clearScreen()
      process.stdout.write(chalk.dim('載入書籍資訊...\n'))

      let book
      try {
        book = await getBook(action.book.id)
      } catch (err) {
        await handleError(err)
        continue searchLoop
      }

      const decision = await showBookDetail(book)
      if (!decision) continue

      // 開始下載全文
      const textUrl = getTextUrl(book.formats)!
      clearScreen()
      process.stdout.write(chalk.dim('下載書本全文中（可能需要數秒）...\n'))

      let lines: string[]
      try {
        lines = await fetchLines(textUrl)
      } catch (err) {
        await handleError(err)
        continue
      }

      showCursor()
      await runReader(book.title, lines)
      hideCursor()
    }
  }
}

const MENU_ITEMS = ['搜尋書籍', '回上層'] as const
const TOTAL = MENU_ITEMS.length

export async function runBooks(): Promise<void> {
  let selected = 0

  const render = () => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('書庫\n\n'))
    MENU_ITEMS.forEach((label, i) => {
      if (i === TOTAL - 1) process.stdout.write('    ──────────\n')
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()

    if (key === 'q' || key === 'ctrl+c') break
    else if (key === 'up' || key === 'k') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down' || key === 'j') selected = (selected + 1) % TOTAL
    else if (key === 'enter') {
      if (selected === 0) {
        showCursor()
        await runSearch()
        hideCursor()
      } else {
        break
      }
    }
  }
}
