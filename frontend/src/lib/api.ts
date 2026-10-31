const TOKEN_KEY = 'crm_token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`/api${path}`, { ...init, headers })
  if (res.ok) return res

  let message = res.statusText || 'Request failed'
  try {
    const body = await res.json()
    message = Array.isArray(body.message) ? body.message.join('\n') : (body.message ?? message)
  } catch {
    /* not JSON */
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized()
  throw new ApiError(res.status, message)
}

export const api = {
  get: async <T>(path: string) => (await request(path)).json() as Promise<T>,
  post: async <T>(path: string, body?: unknown) =>
    (await request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })).json() as Promise<T>,
  patch: async <T>(path: string, body: unknown) =>
    (await request(path, { method: 'PATCH', body: JSON.stringify(body) })).json() as Promise<T>,
  delete: async <T>(path: string) => (await request(path, { method: 'DELETE' })).json() as Promise<T>,
  download: async (path: string, filename: string) => {
    const blob = await (await request(path)).blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
