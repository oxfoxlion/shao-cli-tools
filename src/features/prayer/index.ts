import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { AuthError, NetworkError } from '../../lib/api.js'
import { fetchMe, login, register } from '../goodthing/client.js'
import {
  fetchBooks, createBook, updateBook, deleteBook,
  fetchItems, createItem, updateItem, deleteItem, toggleAnswer, toggleArchive,
  fetchEntries, createEntry, fetchEntry, deleteEntry,
  type Book, type Item,
} from './client.js'
import {
  readLine,
  showBookList, showBookForm, showBookMenu,
  showEntriesList, showAddEntryForm, showEntryDetail,
  showItemList, showItemMenu, showItemForm,
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

  const render = (): void => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('需要登入\n\n'))
    process.stdout.write('禱告日記使用小小好事帳號登入\n\n')
    items.forEach((label, i) => {
      if (i === 2) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇\n'))
  }
  registerRender(render)
  render()

  let choice = -1
  while (true) {
    const key = await waitForKey()
    if (key === 'q' || key === 'ctrl+c') return false
    if (key === 'up') { selected = (selected - 1 + 3) % 3; render() }
    else if (key === 'down') { selected = (selected + 1) % 3; render() }
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
    choice === 0 ? await login(nickname, pin) : await register(nickname, pin)
    process.stdout.write(chalk.green('✓ 登入成功\n'))
    process.stdout.write(chalk.dim('按任意鍵繼續...\n'))
    await waitForKey()
    return true
  } catch (err) {
    const msg = err instanceof NetworkError ? err.message
      : err instanceof AuthError ? '暱稱或 PIN 錯誤'
        : '發生錯誤，請稍後再試'
    process.stdout.write(chalk.red(`\n${msg}\n`))
    process.stdout.write(chalk.dim('按任意鍵返回...\n'))
    await waitForKey()
    return false
  }
}

async function showError(err: unknown): Promise<void> {
  const msg = err instanceof NetworkError ? err.message : '發生未知錯誤'
  process.stdout.write(chalk.red(`\n錯誤：${msg}\n`))
  process.stdout.write(chalk.dim('按任意鍵返回...\n'))
  await waitForKey()
}

// ─── Entries flow ─────────────────────────────────────────────────────────────

async function runEntries(book: Book): Promise<void> {
  while (true) {
    clearScreen()
    process.stdout.write(chalk.dim('載入禱告記錄...\n'))

    let entries
    try {
      const res = await fetchEntries(book.id)
      entries = res.entries
    } catch (err) {
      await showError(err)
      return
    }

    const result = await showEntriesList(entries, book.title)
    if (result.action === 'back') return

    if (result.action === 'new') {
      showCursor()
      clearScreen()
      process.stdout.write(chalk.dim('載入禱告事項...\n'))
      let items: Item[] = []
      try {
        const res = await fetchItems()
        items = res.items
      } catch { /* best effort */ }

      const form = await showAddEntryForm(items)
      hideCursor()
      if (!form) continue

      clearScreen()
      process.stdout.write(chalk.dim('儲存中...\n'))
      try {
        await createEntry(book.id, {
          content: form.content || undefined,
          prayed_at: form.prayed_at,
          item_ids: form.item_ids.length > 0 ? form.item_ids : undefined,
        })
        process.stdout.write(chalk.green('✓ 禱告記錄已儲存\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        await showError(err)
      }
      continue
    }

    // action === 'select'
    const entry = entries[result.index]
    clearScreen()
    process.stdout.write(chalk.dim('載入記錄詳情...\n'))

    let fullEntry
    try {
      const res = await fetchEntry(book.id, entry.id)
      fullEntry = res.entry
    } catch (err) {
      await showError(err)
      continue
    }

    showCursor()
    const detailAction = await showEntryDetail(fullEntry, book.title)
    hideCursor()

    if (detailAction === 'delete') {
      clearScreen()
      process.stdout.write(chalk.dim('刪除中...\n'))
      try {
        await deleteEntry(book.id, entry.id)
        process.stdout.write(chalk.green('✓ 已刪除\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        await showError(err)
      }
    }
  }
}

// ─── Books flow ───────────────────────────────────────────────────────────────

async function runBooks(): Promise<void> {
  while (true) {
    clearScreen()
    process.stdout.write(chalk.dim('載入禱告本...\n'))

    let books
    try {
      const res = await fetchBooks()
      books = res.books
    } catch (err) {
      await showError(err)
      return
    }

    const listResult = await showBookList(books)
    if (listResult.action === 'back') return

    if (listResult.action === 'new') {
      showCursor()
      const form = await showBookForm()
      hideCursor()
      if (!form) continue

      clearScreen()
      process.stdout.write(chalk.dim('建立中...\n'))
      try {
        await createBook(form.title, form.description || undefined)
        process.stdout.write(chalk.green('✓ 禱告本已建立\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        await showError(err)
      }
      continue
    }

    // action === 'select'
    let book = books[listResult.index]

    bookLoop: while (true) {
      const menuAction = await showBookMenu(book)

      if (menuAction === 'back') break

      if (menuAction === 'entries') {
        showCursor()
        await runEntries(book)
        hideCursor()
      } else if (menuAction === 'add-entry') {
        showCursor()
        clearScreen()
        process.stdout.write(chalk.dim('載入禱告事項...\n'))
        let items: Item[] = []
        try {
          const res = await fetchItems()
          items = res.items
        } catch { /* best effort */ }

        const form = await showAddEntryForm(items)
        hideCursor()
        if (!form) continue

        clearScreen()
        process.stdout.write(chalk.dim('儲存中...\n'))
        try {
          await createEntry(book.id, {
            content: form.content || undefined,
            prayed_at: form.prayed_at,
            item_ids: form.item_ids.length > 0 ? form.item_ids : undefined,
          })
          process.stdout.write(chalk.green('✓ 禱告記錄已儲存\n'))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        } catch (err) {
          await showError(err)
        }
      } else if (menuAction === 'edit') {
        showCursor()
        const form = await showBookForm({ title: book.title, description: book.description })
        hideCursor()
        if (!form) continue

        clearScreen()
        process.stdout.write(chalk.dim('更新中...\n'))
        try {
          const res = await updateBook(book.id, { title: form.title, description: form.description || undefined })
          book = res.book
          process.stdout.write(chalk.green('✓ 已更新\n'))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        } catch (err) {
          await showError(err)
        }
      } else if (menuAction === 'delete') {
        clearScreen()
        process.stdout.write(chalk.yellow(`確認刪除「${book.title}」？（含所有禱告記錄）\nEnter 確認，其他鍵取消\n`))
        const confirm = await waitForKey()
        if (confirm === 'enter') {
          clearScreen()
          process.stdout.write(chalk.dim('刪除中...\n'))
          try {
            await deleteBook(book.id)
            process.stdout.write(chalk.green('✓ 已刪除\n'))
            process.stdout.write(chalk.dim('按任意鍵返回...\n'))
            await waitForKey()
            break bookLoop
          } catch (err) {
            await showError(err)
          }
        }
      }
    }
  }
}

// ─── Items flow ───────────────────────────────────────────────────────────────

async function runItems(): Promise<void> {
  let isArchived = false

  while (true) {
    clearScreen()
    process.stdout.write(chalk.dim('載入禱告事項...\n'))

    let items
    try {
      const res = await fetchItems({ is_archived: isArchived })
      items = res.items
    } catch (err) {
      await showError(err)
      return
    }

    const listResult = await showItemList(items, isArchived)

    if (listResult.action === 'back') return
    if (listResult.action === 'toggle-filter') { isArchived = !isArchived; continue }

    if (listResult.action === 'new') {
      showCursor()
      const form = await showItemForm()
      hideCursor()
      if (!form) continue

      clearScreen()
      process.stdout.write(chalk.dim('建立中...\n'))
      try {
        await createItem({
          title: form.title,
          content: form.content || undefined,
          recurrence: form.recurrence,
        })
        process.stdout.write(chalk.green('✓ 禱告事項已建立\n'))
        process.stdout.write(chalk.dim('按任意鍵返回...\n'))
        await waitForKey()
      } catch (err) {
        await showError(err)
      }
      continue
    }

    // action === 'select'
    let item = items[listResult.index]

    itemLoop: while (true) {
      const menuAction = await showItemMenu(item)

      if (menuAction === 'back') break

      if (menuAction === 'toggle-answer') {
        clearScreen()
        process.stdout.write(chalk.dim('更新中...\n'))
        try {
          const res = await toggleAnswer(item.id)
          item = { ...item, is_answered: res.item.is_answered }
          process.stdout.write(chalk.green(`✓ ${res.item.is_answered ? '已標記應允' : '已取消應允'}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        } catch (err) {
          await showError(err)
        }
      } else if (menuAction === 'toggle-archive') {
        clearScreen()
        process.stdout.write(chalk.dim('更新中...\n'))
        try {
          const res = await toggleArchive(item.id)
          item = { ...item, is_archived: res.item.is_archived }
          process.stdout.write(chalk.green(`✓ ${res.item.is_archived ? '已封存' : '已取消封存'}\n`))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
          break itemLoop
        } catch (err) {
          await showError(err)
        }
      } else if (menuAction === 'edit') {
        showCursor()
        const form = await showItemForm(item)
        hideCursor()
        if (!form) continue

        clearScreen()
        process.stdout.write(chalk.dim('更新中...\n'))
        try {
          const res = await updateItem(item.id, {
            title: form.title,
            content: form.content || undefined,
            recurrence: form.recurrence,
          })
          item = res.item
          process.stdout.write(chalk.green('✓ 已更新\n'))
          process.stdout.write(chalk.dim('按任意鍵返回...\n'))
          await waitForKey()
        } catch (err) {
          await showError(err)
        }
      } else if (menuAction === 'delete') {
        clearScreen()
        process.stdout.write(chalk.yellow(`確認刪除「${item.title}」？\nEnter 確認，其他鍵取消\n`))
        const confirm = await waitForKey()
        if (confirm === 'enter') {
          clearScreen()
          process.stdout.write(chalk.dim('刪除中...\n'))
          try {
            await deleteItem(item.id)
            process.stdout.write(chalk.green('✓ 已刪除\n'))
            process.stdout.write(chalk.dim('按任意鍵返回...\n'))
            await waitForKey()
            break itemLoop
          } catch (err) {
            await showError(err)
          }
        }
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const MENU_ITEMS = ['禱告本', '禱告事項', '回上層'] as const
const TOTAL = MENU_ITEMS.length

export async function runPrayer(): Promise<void> {
  clearScreen()
  hideCursor()
  process.stdout.write(chalk.dim('確認登入狀態...\n'))

  if (!await ensureAuth()) return

  let selected = 0

  const render = (): void => {
    clearScreen()
    hideCursor()
    process.stdout.write(chalk.bold('禱告日記\n\n'))
    MENU_ITEMS.forEach((label, i) => {
      if (i === TOTAL - 1) process.stdout.write(`    ──────────\n`)
      process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
    })
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 返回\n'))
  }
  registerRender(render)

  while (true) {
    render()
    const key = await waitForKey()

    if (key === 'q' || key === 'ctrl+c') break
    else if (key === 'up') selected = (selected - 1 + TOTAL) % TOTAL
    else if (key === 'down') selected = (selected + 1) % TOTAL
    else if (key === 'enter') {
      showCursor()
      if (selected === 0) await runBooks()
      else if (selected === 1) await runItems()
      else break
      hideCursor()
    }
  }
}
