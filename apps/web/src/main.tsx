import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { setupServiceWorker } from './lib/serviceWorker'

// Offline mode: keeps the app and the last data on the device (see lib/serviceWorker.ts).
setupServiceWorker()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      // Run queries even without connectivity: the service worker answers with the saved copy.
      networkMode: 'offlineFirst',
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)

// Android app (Capacitor): the native launch screen stays up until the first real frame is
// painted, then fades out — no white flash while the page loads. No-op in a normal browser.
const capacitor = (window as any).Capacitor
if (capacitor?.isNativePlatform?.()) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    capacitor.nativePromise?.('SplashScreen', 'hide', { fadeOutDuration: 250 }).catch(() => {})
  }))
}
