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
