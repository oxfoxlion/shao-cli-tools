#!/usr/bin/env node
import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor } from './lib/screen.js'
import { waitForKey } from './lib/input.js'
import { runGames } from './features/games/index.js'
import { runGoodthing } from './features/goodthing/index.js'

const VERSION = '1.0'

const MENU_ITEMS = ['遊戲', '小小好事'] as const
const TOTAL = MENU_ITEMS.length + 1 // +1 for 離開

function renderMenu(selected: number): void {
  clearScreen()
  process.stdout.write(chalk.bold(`邵的工具包 v${VERSION}\n\n`))

  MENU_ITEMS.forEach((label, i) => {
    process.stdout.write(i === selected ? chalk.cyan(`  ▶ ${label}\n`) : `    ${label}\n`)
  })

  process.stdout.write(`    ──────────\n`)
  process.stdout.write(selected === MENU_ITEMS.length ? chalk.cyan(`  ▶ 離開\n`) : `    離開\n`)
  process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 離開\n'))
}

async function main(): Promise<void> {
  process.on('exit', () => showCursor())

  hideCursor()
  let selected = 0

  while (true) {
    renderMenu(selected)
    const key = await waitForKey()

    if (key === 'up') {
      selected = (selected - 1 + TOTAL) % TOTAL
    } else if (key === 'down') {
      selected = (selected + 1) % TOTAL
    } else if (key === 'q' || key === 'ctrl+c') {
      break
    } else if (key === 'enter') {
      if (selected === 0) {
        showCursor()
        await runGames()
        hideCursor()
      } else if (selected === 1) {
        showCursor()
        await runGoodthing()
        hideCursor()
      } else {
        break
      }
    }
  }

  showCursor()
  clearScreen()
}

main().catch((err: unknown) => {
  showCursor()
  console.error(err)
  process.exit(1)
})
