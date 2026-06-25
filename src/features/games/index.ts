import chalk from 'chalk'
import { clearScreen, hideCursor, showCursor } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'
import { fetchGames, type Game } from './client.js'
import { playGame } from './player.js'
import { NetworkError } from '../../lib/api.js'

export async function runGames(): Promise<void> {
  let games: Game[] = []

  clearScreen()
  hideCursor()
  process.stdout.write(chalk.dim('載入遊戲清單...\n'))

  try {
    games = await fetchGames()
  } catch (err) {
    showCursor()
    if (err instanceof NetworkError) {
      process.stdout.write(chalk.red(`\n錯誤：${err.message}\n`))
    } else {
      process.stdout.write(chalk.red('\n無法載入遊戲清單\n'))
    }
    process.stdout.write(chalk.dim('按任意鍵返回...\n'))
    await waitForKey()
    return
  }

  let selected = 0
  const TOTAL = games.length + 1 // +1 for 回上層

  const render = () => {
    clearScreen()
    process.stdout.write(chalk.bold('遊戲\n\n'))
    games.forEach((game, i) => {
      if (i === selected) {
        process.stdout.write(chalk.cyan(`  ▶ ${game.title}\n`))
      } else {
        process.stdout.write(`    ${game.title}\n`)
      }
    })
    process.stdout.write(`    ──────────\n`)
    if (selected === games.length) {
      process.stdout.write(chalk.cyan(`  ▶ 回上層\n`))
    } else {
      process.stdout.write(`    回上層\n`)
    }
    process.stdout.write(chalk.dim('\n↑↓ 移動  Enter 選擇  q 回上層\n'))
  }

  while (true) {
    render()
    const key = await waitForKey()

    if (key === 'up') {
      selected = (selected - 1 + TOTAL) % TOTAL
    } else if (key === 'down') {
      selected = (selected + 1) % TOTAL
    } else if (key === 'q' || key === 'ctrl+c') {
      break
    } else if (key === 'enter') {
      if (selected === games.length) break
      showCursor()
      try {
        await playGame(games[selected])
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
