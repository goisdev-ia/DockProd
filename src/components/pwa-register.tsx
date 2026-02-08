'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return
    const registerSw = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (reg.installing) return
          reg.update().catch(() => {})
        })
        .catch(() => {})
    }
    if (document.readyState === 'complete') {
      registerSw()
    } else {
      window.addEventListener('load', registerSw)
    }
    return () => window.removeEventListener('load', registerSw)
  }, [])
  return null
}
