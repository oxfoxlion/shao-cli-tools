import chalk from 'chalk'
import { clearScreen, hideCursor, registerRender } from '../../lib/screen.js'
import { waitForKey } from '../../lib/input.js'

export async function runReader(title: string, lines: string[]): Promise<void> {
  let offset = 0

  const viewHeight = () => Math.max(5, (process.stdout.rows ?? 24) - 3)
  const clamp = (n: number) => Math.max(0, Math.min(n, lines.length - viewHeight()))

  const render = () => {
    clearScreen()
    hideCursor()
    const vh = viewHeight()
    offset = clamp(offset)
    const end = Math.min(offset + vh, lines.length)
    const shortTitle = title.length > 50 ? title.slice(0, 49) + '…' : title
    process.stdout.write(chalk.bold(shortTitle) + chalk.dim(` (行 ${offset + 1}/${lines.length})\n`)  )

    for (let i = offset; i < end; i++) {
      process.stdout.write(lines[i] + '\n')
    }

    process.stdout.write(chalk.dim('\nj/k 移動  d/u 翻頁  g 首行  G 末行  q 返回\n'))
  }
  registerRender(render)
  render()

  while (true) {
    const key = await waitForKey()
    const vh = viewHeight()

    if (key === 'q' || key === 'ctrl+c' || key === 'escape') break
    if (key === 'j' || key === 'down') { offset = clamp(offset + 1); render() }
    if (key === 'k' || key === 'up') { offset = clamp(offset - 1); render() }
    if (key === 'd') { offset = clamp(offset + vh); render() }
    if (key === 'u') { offset = clamp(offset - vh); render() }
    if (key === 'g') { offset = 0; render() }
    if (key === 'G') { offset = clamp(lines.length - vh); render() }
  }
}
