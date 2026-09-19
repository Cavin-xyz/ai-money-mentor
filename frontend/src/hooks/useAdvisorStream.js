import { useCallback, useRef, useState } from 'react'
import { streamSse } from '../lib/api'

const EMPTY = { status: 'idle', stages: {}, partial: null, citations: [], result: null, error: null }

/**
 * Runs one module through the backend pipeline and exposes each stage as it lands:
 * `partial` (engine numbers, ~1 s) → `citations` → `result` (with the checked explanation).
 */
export function useAdvisorStream(path) {
  const [state, setState] = useState(EMPTY)
  const ctrl = useRef(null)

  const run = useCallback(async (body) => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState({ ...EMPTY, status: 'running' })
    let gotResult = false
    try {
      await streamSse(path, body, {
        stage: (s) => setState((p) => ({ ...p, stages: { ...p.stages, [s.step]: s } })),
        calc: (d) => setState((p) => ({ ...p, partial: d })),
        sources: (d) => setState((p) => ({ ...p, citations: d.citations || [] })),
        result: (d) => {
          gotResult = true
          setState((p) => ({ ...p, result: d, status: 'done' }))
        },
        error: (d) => setState((p) => ({ ...p, status: 'error', error: d.message })),
      }, { signal: c.signal })
      if (!gotResult) {
        setState((p) => (p.status === 'error' ? p : { ...p, status: 'error', error: 'The response ended early. Please try again.' }))
      }
    } catch (e) {
      if (e.name !== 'AbortError') setState((p) => ({ ...p, status: 'error', error: e.message }))
    }
  }, [path])

  const reset = useCallback(() => {
    ctrl.current?.abort()
    setState(EMPTY)
  }, [])

  /** Show a saved result (from history) without re-running anything. */
  const restore = useCallback((result) => {
    setState({ ...EMPTY, status: 'done', result, citations: result?.meta?.citations || [] })
  }, [])

  /** Replace numbers after an instant what-if recalculation, keeping the explanation. */
  const patch = useCallback((fn) => {
    setState((p) => ({ ...p, result: p.result ? fn(p.result) : p.result }))
  }, [])

  return {
    ...state,
    data: state.result || state.partial,
    running: state.status === 'running',
    run,
    reset,
    restore,
    patch,
  }
}
