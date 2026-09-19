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

const LANG_KEY = 'finmind.lang'

/** The language explicitly chosen on this device, or null. */
export function getLanguage() {
  try {
    return localStorage.getItem(LANG_KEY)
  } catch {
    return null
  }
}

export function setLanguage(code) {
  try {
    localStorage.setItem(LANG_KEY, code)
  } catch {
    /* storage unavailable — the choice lasts for this session only */
  }
}

function headers(extra = {}) {
  const h = { ...extra }
  const id = getProfileId()
  if (id) h['X-Profile-Id'] = id
  const lang = getLanguage()
  if (lang) h['X-Language'] = lang
  return h
}

// Fixed server messages mapped to i18n keys, so they follow the chosen language too.
const SERVER_ERRORS = {
  'The local AI model is starting up or not running. Try again in a few seconds.': 'err.modelStarting',
  'Something went wrong while preparing your guidance. Please try again.': 'err.generic',
  'Something went wrong. Please try again.': 'err.generic',
  'Paste a message, or enter a UPI ID or app name': 'scam.errEmpty',
  'That username is taken': 'auth.err.taken',
  'Wrong username or passphrase': 'auth.err.wrong',
  'Too many attempts. Try again in a few minutes.': 'auth.err.locked',
  'Passphrase must be at least 10 characters': 'auth.err.short',
  "Pick a passphrase that isn't based on your username or the app's name": 'auth.err.weak',
  'Username: 3–32 characters, letters, digits, dot, dash or underscore': 'auth.err.username',
  'Please sign in to continue.': 'auth.err.signInRequired',
  'That profile belongs to another account': 'auth.err.forbidden',
  'Monthly income and expenses are required': 'err.incomeRequired',
  'Please enter salary for both partners': 'couples.errSalary',
}

function errorKey(message) {
  return SERVER_ERRORS[message] || message
}

async function handle(response) {
  let data = null
  try {
    data = await response.json()
  } catch {
    /* non-JSON body */
  }
  if (!response.ok || (data && data.error)) {
    throw new Error(errorKey(data && data.error) || friendlyStatus(response.status))
  }
  return data
}

// Friendly errors are i18n keys; components show them with t(), which passes server messages through unchanged.
function friendlyStatus(status) {
  if (status === 503) return 'err.modelStarting'
  if (status === 0 || status === 502 || status === 504) return 'err.backend'
  return `Request failed (HTTP ${status})`
}

async function request(path, init) {
  try {
    return await handle(await fetch(`${API_URL}${path}`, init))
  } catch (err) {
    if (err instanceof TypeError) throw new Error('err.backend')
    throw err
  }
}

export function getJson(path) {
  return request(path, { headers: headers(), credentials: 'include' })
}

// ── accounts ──────────────────────────────────────────────────────
// The session token lives in an HttpOnly cookie, so there is nothing for these to store:
// `credentials: 'include'` is what carries it (and lets a separate UI origin work too).

export function getMe() {
  return getJson('/api/auth/me')
}

export function registerAccount(body) {
  return postJson('/api/auth/register', body)
}

export function signIn(body) {
  return postJson('/api/auth/login', body)
}

export function signOut() {
  return postJson('/api/auth/logout', {})
}

export function postJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
    credentials: 'include',
  })
}

export function putJson(path, body) {
  return request(path, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
    credentials: 'include',
  })
}

export function deleteJson(path) {
  return request(path, { method: 'DELETE', headers: headers(), credentials: 'include' })
}

export function postForm(path, formData) {
  return request(path, { method: 'POST', headers: headers(), body: formData, credentials: 'include' })
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
      credentials: 'include',
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') return
    throw new Error('err.backend')
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
  if (event === 'error' && data && typeof data.message === 'string') data = { ...data, message: errorKey(data.message) }
  const fn = handlers[event]
  if (fn) fn(data)
}
