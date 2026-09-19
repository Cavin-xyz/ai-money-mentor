import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { deleteJson, getJson, getProfileId, postJson, putJson, setProfileId } from '../lib/api'

const EMPTY = { profile: null, prefs: { language: 'en', investmentStyle: 'balanced', notifications: false }, goals: [], history: [] }

const ProfileContext = createContext(null)

/**
 * Persistent user memory on the client side: the saved profile, goals, preferences and
 * history (all stored in the local SQLite file by the backend), plus the drawer state.
 */
export function ProfileProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [drawer, setDrawer] = useState({ open: false, tab: 'profile' })
  const [restoreRequest, setRestoreRequest] = useState(null)

  const load = useCallback(async () => {
    const id = getProfileId()
    if (!id) {
      setData(EMPTY)
      return
    }
    try {
      setData(await getJson(`/api/profile/${id}`))
    } catch {
      setProfileId(null) // profile was deleted or DB reset
      setData(EMPTY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const id = getProfileId()
    if (!id) return undefined
    getJson(`/api/profile/${id}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setProfileId(null) })
    return () => { cancelled = true }
  }, [])

  const create = useCallback(async (fields) => {
    const d = await postJson('/api/profile', fields)
    setProfileId(d.profile.id)
    setData(d)
    return d
  }, [])

  const update = useCallback(async (fields) => {
    const id = getProfileId()
    if (!id) return create(fields)
    const d = await putJson(`/api/profile/${id}`, fields)
    setData(d)
    return d
  }, [create])

  const updatePrefs = useCallback(async (prefs) => {
    const id = getProfileId()
    if (!id) return
    const p = await putJson(`/api/profile/${id}/prefs`, prefs)
    setData((d) => ({ ...d, prefs: p }))
  }, [])

  const addGoal = useCallback(async (goal) => {
    const id = getProfileId()
    if (!id) return
    const goals = await postJson(`/api/profile/${id}/goals`, goal)
    setData((d) => ({ ...d, goals }))
  }, [])

  const deleteGoal = useCallback(async (goalId) => {
    const id = getProfileId()
    if (!id) return
    const goals = await deleteJson(`/api/profile/${id}/goals/${goalId}`)
    setData((d) => ({ ...d, goals }))
  }, [])

  const deleteEverything = useCallback(async () => {
    const id = getProfileId()
    if (id) await deleteJson(`/api/profile/${id}`)
    setProfileId(null)
    setData(EMPTY)
  }, [])

  /** Re-open a past run: the module listening for this name restores the saved result. */
  const reopen = useCallback(async (interactionId) => {
    const id = getProfileId()
    if (!id) return
    const item = await getJson(`/api/profile/${id}/history/${interactionId}`)
    setRestoreRequest({ ...item, nonce: Date.now() })
    setDrawer((d) => ({ ...d, open: false }))
  }, [])

  const value = useMemo(() => ({
    ...data,
    hasProfile: !!data.profile,
    drawer,
    openDrawer: (tab = 'profile') => setDrawer({ open: true, tab }),
    closeDrawer: () => setDrawer((d) => ({ ...d, open: false })),
    setDrawerTab: (tab) => setDrawer((d) => ({ ...d, tab })),
    refresh: load,
    create,
    update,
    updatePrefs,
    addGoal,
    deleteGoal,
    deleteEverything,
    reopen,
    restoreRequest,
  }), [data, drawer, load, create, update, updatePrefs, addGoal, deleteGoal, deleteEverything, reopen, restoreRequest])

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  return useContext(ProfileContext)
}

/** Maps saved profile fields onto a module's form field names, skipping blanks. */
// eslint-disable-next-line react-refresh/only-export-components
export function profileValues(profile, mapping) {
  const out = {}
  if (!profile) return out
  for (const [formKey, profileKey] of Object.entries(mapping)) {
    const v = profile[profileKey]
    if (v !== undefined && v !== null && `${v}` !== '') out[formKey] = `${v}`
  }
  return out
}
