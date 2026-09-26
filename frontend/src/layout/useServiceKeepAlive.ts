import { useEffect } from 'react'
import { getApiBaseUrl, getMlApiBaseUrl } from '../lib/apiToken'

const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000

export function useServiceKeepAlive(): void {
  useEffect(() => {
    const ping = (serviceName: string, url: string) => {
      void fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        keepalive: true,
      }).catch((error: unknown) => {
        console.warn(`${serviceName} keep-alive request failed.`, error)
      })
    }

    const pingServices = () => {
      ping('Backend', `${getApiBaseUrl()}/`)
      ping('ML API', `${getMlApiBaseUrl()}/openapi.json`)
    }

    pingServices()
    const intervalId = window.setInterval(pingServices, KEEP_ALIVE_INTERVAL_MS)
    document.addEventListener('visibilitychange', pingServices)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', pingServices)
    }
  }, [])
}
