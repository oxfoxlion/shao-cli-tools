function parseKey(data: string): string | null {
  if (data === '\x1b[A') return 'up'
  if (data === '\x1b[B') return 'down'
  if (data === '\x1b[C') return 'right'
  if (data === '\x1b[D') return 'left'
  if (data === '\r' || data === '\n') return 'enter'
  if (data === '\x1b') return 'escape'
  if (data === '\x7f' || data === '\x08') return 'backspace'
  if (data === ' ') return 'space'
  if (data === '\x03') return 'ctrl+c'
  if (data.length === 1 && data >= ' ') return data.toLowerCase()
  return null
}

function ensureRawMode(): void {
  if (!process.stdin.isRaw && process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
  }
}

export function waitForKey(): Promise<string> {
  ensureRawMode()
  return new Promise((resolve) => {
    const onData = (data: string) => {
      const key = parseKey(data)
      if (key !== null) {
        process.stdin.off('data', onData)
        resolve(key)
      }
    }
    process.stdin.on('data', onData)
  })
}

export function startInput(handler: (key: string) => void): () => void {
  ensureRawMode()
  const onData = (data: string) => {
    const key = parseKey(data)
    if (key !== null) handler(key)
  }
  process.stdin.on('data', onData)
  return () => process.stdin.off('data', onData)
}
