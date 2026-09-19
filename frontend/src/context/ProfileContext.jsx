import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { deleteJson, getJson, getMe, getProfileId, postJson, putJson, registerAccount, setProfileId, signIn as apiSignIn, signOut as apiSignOut } from '../lib/api'

const EMPTY = { profile: null, prefs: { language: 'en', investmentStyle: 'balanced', notifications: false }, goals: [], history: [] }
const NO_ACCOUNT = { ready: false, authenticated: false, username: null, required: false }

const ProfileContext = createContext(null)

/**
 * Persistent user memory on the client side: the saved profile, goals, preferences and
 * history (all stored in the local SQLite file by the backend), plus the drawer state.
 */
export function ProfileProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [auth, setAuth] = useState(NO_ACCOUNT)
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

  /**
   * On load, ask the backend who we are. A session cookie decides the profile id; without one
   * the browser's own guest id is used, which is what keeps the app usable with no account.
   */
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      let me = { authenticated: false, authRequired: false }
      try {
        me = await getMe()
      } catch {
        /* backend not up yet — stay in guest mode */
      }
      if (cancelled) return
      setAuth({ ready: true, authenticated: !!me.authenticated, username: me.username ?? null, required: !!me.authRequired })
      if (me.authenticated) setProfileId(me.profileId)
      const id = me.authenticated ? me.profileId : getProfileId()
      if (!id) return
      try {
        const d = await getJson(`/api/profile/${id}`)
        if (!cancelled) setData(d)
      } catch {
        if (!cancelled && !me.authenticated) setProfileId(null)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  /** Signing up carries the guest profile over, so nothing entered before the account is lost. */
  const createAccount = useCallback(async (username, passphrase) => {
    const me = await registerAccount({ username, passphrase })
    setProfileId(me.profileId)
    setAuth({ ready: true, authenticated: true, username: me.username, required: !!me.authRequired })
    setData(await getJson(`/api/profile/${me.profileId}`))
  }, [])

  const login = useCallback(async (username, passphrase) => {
    const me = await apiSignIn({ username, passphrase })
    setProfileId(me.profileId)
    setAuth({ ready: true, authenticated: true, username: me.username, required: !!me.authRequired })
    setData(await getJson(`/api/profile/${me.profileId}`))
  }, [])

  /** Clears the local id too, so the next person on this laptop starts empty. */
  const logout = useCallback(async () => {
    try {
      await apiSignOut()
    } finally {
      setProfileId(null)
      setData(EMPTY)
      setAuth((a) => ({ ...a, authenticated: false, username: null }))
    }
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
    setAuth((a) => ({ ...a, authenticated: false, username: null }))
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
    auth,
    createAccount,
    login,
    logout,
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
  }), [data, auth, createAccount, login, logout, drawer, load, create, update, updatePrefs, addGoal, deleteGoal, deleteEverything, reopen, restoreRequest])

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
