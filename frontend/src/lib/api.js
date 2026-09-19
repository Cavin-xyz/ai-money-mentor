// Single API layer for the app. All calls go to the local Spring Boot backend
// (same origin in production, proxied by Vite in dev) — nothing leaves the laptop.

const API_URL = import.meta.env.VITE_API_URL || ''
const PROFILE_KEY = 'mm.profileId'

export function getProfileId() {
  try {
    return localStorage.getItem(PROFILE_KEY)
  } catch {
    return null
  }
}

export function setProfileId(id) {
  try {
    if (id) localStorage.setItem(PROFILE_KEY, id)
    else localStorage.removeItem(PROFILE_KEY)
  } catch {
    /* storage unavailable (private mode) — profile just won't persist */
  }
}

function headers(extra = {}) {
  const h = { ...extra }
  const id = getProfileId()
  if (id) h['X-Profile-Id'] = id
  return h
}

async function handle(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    /* non-JSON body */
  }
  if (!response.ok || (data && data.error)) {
    throw new Error((data && data.error) || friendlyStatus(response.status))
  }
  return data
}

function friendlyStatus(status) {
  if (status === 503) return 'The local AI model is starting up. Try again in a few seconds.'
  if (status === 0 || status === 502 || status === 504) return 'Cannot reach the local backend. Is it running?'
  return `Request failed (HTTP ${status})`
}

async function request(path, init) {
  try {
    return await handle(await fetch(`${API_URL}${path}`, init))
  } catch (err) {
    if (err instanceof TypeError) throw new Error('Cannot reach the local backend. Is it running on port 8080?')
    throw err
  }
}

export function getJson(path) {
  return request(path, { headers: headers() })
}

export function postJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
}

export function putJson(path, body) {
  return request(path, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  })
}

export function deleteJson(path) {
  return request(path, { method: 'DELETE', headers: headers() })
}

export function postForm(path, formData) {
  return request(path, { method: 'POST', headers: headers(), body: formData })
}

/**
 * POST that returns Server-Sent Events. EventSource cannot POST, so we read the
 * stream ourselves. `handlers` keys: stage, calc, sources, token, result, error.
 * `body` may be a FormData (multipart) or a plain object (JSON).
 */
export async function streamSse(path, body, handlers = {}, { signal } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: headers(isForm ? { Accept: 'text/event-stream' } : { 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: isForm ? body : JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') return
    throw new Error('Cannot reach the local backend. Is it running on port 8080?')
  }
  if (!response.ok) {
    await handle(response) // throws with the server's message
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx).replace(/^\r?\n\r?\n/, '')
      dispatch(block, handlers)
    }
  }
  if (buffer.trim()) dispatch(buffer, handlers)
}

function dispatch(block, handlers) {
  let event = 'message'
  const dataLines = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (!dataLines.length) return
  const raw = dataLines.join('\n')
  let data = raw
  try {
    data = JSON.parse(raw)
  } catch {
    /* plain text payload */
  }
  const fn = handlers[event]
  if (fn) fn(data)
}
