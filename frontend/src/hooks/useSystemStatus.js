import { useSyncExternalStore } from 'react'
import { getJson } from '../lib/api'

// One shared poller for every component that shows system health.
let snapshot = { status: null, backendDown: false }
const listeners = new Set()
let timer = null

async function tick() {
  try {
    const status = await getJson('/api/system/status')
    snapshot = { status, backendDown: false }
  } catch {
    snapshot = { status: snapshot.status, backendDown: true }
  }
  listeners.forEach((l) => l())
}

function subscribe(listener) {
  listeners.add(listener)
  if (!timer) {
    tick()
    timer = setInterval(tick, 15000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function refreshSystemStatus() {
  return tick()
}

export function useSystemStatus() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}
