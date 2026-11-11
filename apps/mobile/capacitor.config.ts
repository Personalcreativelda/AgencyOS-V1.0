import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Live updates: the app does not bundle the web build — it loads the deployed AgencyOS web app
 * from `CAP_SERVER_URL`. Every deploy of apps/web (Coolify) reaches phones on the next app open,
 * with no new APK and no Play Store review. Only native changes (plugins, icon, app id) need a
 * new APK.
 *
 * Set the URL when syncing/building, e.g.:
 *   CAP_SERVER_URL=https://app.minhaagencia.com npm run apk:debug
 */
const serverUrl = (process.env.CAP_SERVER_URL || '').replace(/\/+$/, '')

const config: CapacitorConfig = {
  appId: 'com.agencyos.app',
  appName: 'AgencyOS',
  // Tiny local shell: only used for the offline/error screen (and as Capacitor's required webDir).
  webDir: 'www',
  server: serverUrl
    ? {
        url: serverUrl,
        // Shown when the server can't be reached (no internet, server down). Has a "try again".
        errorPath: 'offline.html',
        cleartext: serverUrl.startsWith('http://'),
        // OAuth flows (Meta, Google, TikTok, LinkedIn) redirect back to the app domain.
        allowNavigation: [new URL(serverUrl).host, ...(process.env.CAP_EXTRA_HOSTS || '').split(',').filter(Boolean)],
      }
    : undefined,
  android: {
    // Never allow mixed http content inside the https app.
    allowMixedContent: false,
    // Brand green behind the WebView, so the handoff from the launch screen never flashes white.
    backgroundColor: '#007867',
  },
  plugins: {
    SplashScreen: {
      // The web app hides the splash as soon as it has rendered (apps/web/src/main.tsx) — this
      // duration is only a safety net if the page never reports in (slow network, server down).
      launchShowDuration: 10000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#007867',
      showSpinner: false,
    },
    // System bar colours follow the app theme at runtime (AgencyShell plugin, called by
    // apps/web/src/stores/themeStore.ts) — nothing fixed here.
  },
}

export default config
