export const clearScreen = (): void => {
  process.stdout.write('\x1b[2J\x1b[H')
}

export const cursorHome = (): void => {
  process.stdout.write('\x1b[H')
}

export const hideCursor = (): void => {
  process.stdout.write('\x1b[?25l')
}

export const showCursor = (): void => {
  process.stdout.write('\x1b[?25h')
}

export const enterAltScreen = (): void => {
  process.stdout.write('\x1b[?1049h')
}

export const exitAltScreen = (): void => {
  process.stdout.write('\x1b[?1049l')
}

let activeRender: (() => void) | null = null

export function registerRender(fn: () => void): void {
  activeRender = fn
}

process.stdout.on('resize', () => {
  activeRender?.()
})
