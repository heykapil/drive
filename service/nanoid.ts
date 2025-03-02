import crypto from 'crypto'
export const nanoid = (size: number) => {
  const MASK = 0x3d
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
  const NUMBERS = '1234567890'
  const charset = `${NUMBERS}${LETTERS}${LETTERS.toUpperCase()}_-`.split('')

  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)

  return bytes.reduce((acc, byte) => `${acc}${charset[byte & MASK]}`, '')
}
