export interface CitedRef {
  path: string
  id?: string
  source: string
  verified: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Every object that carries `source` and `verified`, for the review checklist. */
export function listCited(value: unknown, path = "$"): CitedRef[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const key =
        isRecord(item) && typeof item.gpio === "number" ? `gpio${item.gpio}` : String(index)
      return listCited(item, `${path}[${key}]`)
    })
  }
  if (!isRecord(value)) return []

  const own: CitedRef[] = []
  if (typeof value.source === "string" && typeof value.verified === "boolean") {
    own.push({
      path,
      id: typeof value.id === "string" ? value.id : undefined,
      source: value.source,
      verified: value.verified,
    })
  }
  const children = Object.entries(value).flatMap(([key, child]) =>
    listCited(child, `${path}.${key}`),
  )
  return [...own, ...children]
}
