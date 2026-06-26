import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { NetworkError } from '../../lib/api.js'
import { searchBooks, getContent } from './client.js'
import { readLine, showSearchResults, showContent, showNoText } from './views.js'

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

    while (true) {
      clearScreen()
      process.stdout.write(chalk.dim(`搜尋「${keyword}」中...\n`))

      let res
      try {
        res = await searchBooks(keyword.trim(), undefined, searchPage)
      } catch (err) {
        clearScreen()
        process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '搜尋失敗'}\n`))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
        break
      }

      const action = await showSearchResults(res.results, res.count, searchPage, res.next)

      if (!action) break

      if (action.type === 'page') {
        searchPage += action.direction
        continue
      }

      // action.type === 'select'
      const book = action.book

      if (!book.hasText) {
        await showNoText(book.title)
        continue
      }

      // 閱讀流程
      let contentPage = 1
      while (true) {
        clearScreen()
        process.stdout.write(chalk.dim('載入內文...\n'))

        let content
        try {
          content = await getContent(book.id, contentPage)
        } catch (err) {
          clearScreen()
          process.stdout.write(chalk.red(`\n錯誤：${err instanceof NetworkError ? err.message : '無法載入內文'}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
          break
        }

        const result = await showContent(book.title, content.lines, content.page, content.totalPages)

        if (result === 'quit') break
        if (result === 'next' && contentPage < content.totalPages) {
          contentPage++
        }
      }
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
