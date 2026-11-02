const PREFIX = "v1."
const MAX_TOKEN_LENGTH = 20_000
const MAX_JSON_LENGTH = 100_000

export class ShareError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ShareError"
  }
}

export async function encodeShare(json: string): Promise<string> {
  if (json.length > MAX_JSON_LENGTH) throw new ShareError("This design is too large to share.")
  const bytes = new TextEncoder().encode(json)
  const compressed = await gzip(bytes)
  return PREFIX + bytesToBase64Url(compressed)
}

export async function decodeShare(token: string): Promise<string> {
  if (token.length > MAX_TOKEN_LENGTH) throw new ShareError("This link is too long to load.")
  if (!token.startsWith(PREFIX)) throw new ShareError("This link uses an unknown PinPlan format.")
  try {
    const compressed = base64UrlToBytes(token.slice(PREFIX.length))
    const plain = await gunzip(compressed)
    const json = new TextDecoder().decode(plain)
    if (json.length > MAX_JSON_LENGTH) throw new ShareError("This design is too large to load.")
    return json
  } catch (error) {
    if (error instanceof ShareError) throw error
    throw new ShareError("This link could not be read.")
  }
}

// Read and write together. Closing the writer before anything reads deadlocks
// Chromium once the gzip buffer fills, and reading a blob pipe with Response
// can drop the gzip trailer.
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(new CompressionStream("gzip"), bytes)
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(new DecompressionStream("gzip"), bytes)
}

async function pipeBytes(stream: CompressionStream | DecompressionStream, bytes: Uint8Array): Promise<Uint8Array> {
  const output = readStream(stream.readable)
  const writer = stream.writable.getWriter()
  const written = writer.write(ownedBytes(bytes)).then(() => writer.close())
  const [readResult, writeResult] = await Promise.allSettled([output, written])
  if (readResult.status === "fulfilled" && writeResult.status === "fulfilled") return readResult.value
  try {
    await writer.abort()
  } catch {
    // The stream has already failed.
  }
  const reason = readResult.status === "rejected"
    ? readResult.reason
    : writeResult.status === "rejected"
      ? writeResult.reason
      : new Error("This link could not be read.")
  throw reason instanceof Error ? reason : new Error("This link could not be read.")
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}

async function readStream(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    length += value.byteLength
  }
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function base64UrlToBytes(text: string): Uint8Array {
  if (text.length === 0) throw new ShareError("This link could not be read.")
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4))
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/") + pad)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
