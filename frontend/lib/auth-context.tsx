'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { useAuthStore } from './store'

interface FirebaseAuthContextType {
  firebaseUser: User | null
  authLoading:  boolean
}

const FirebaseAuthContext = createContext<FirebaseAuthContextType>({
  firebaseUser: null,
  authLoading:  true,
})

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading]   = useState(true)

  useEffect(() => {
    // Safety valve: if Firebase doesn't resolve within 4 s (e.g. cold start,
    // blocked network), unblock the app so users can still navigate.
    const timer = setTimeout(() => setAuthLoading(false), 4000)

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      clearTimeout(timer)
      setFirebaseUser(user)
      setAuthLoading(false)

      // If Firebase session expired/signed out, clear the backend JWT session too
      if (!user) {
        const { isAuthed, logout } = useAuthStore.getState()
        if (isAuthed) logout()
      }
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])

  return (
    <FirebaseAuthContext.Provider value={{ firebaseUser, authLoading }}>
      {children}
    </FirebaseAuthContext.Provider>
  )
}

export const useFirebaseAuth = () => useContext(FirebaseAuthContext)
