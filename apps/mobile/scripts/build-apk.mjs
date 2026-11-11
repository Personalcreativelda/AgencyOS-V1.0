// Builds the Android APK.
//   CAP_SERVER_URL=https://app.minhaagencia.com npm run apk:debug     (installable test APK)
//   CAP_SERVER_URL=https://app.minhaagencia.com npm run apk:release   (signed with android/keystore.properties)
// Output is copied to apps/mobile/dist/AgencyOS-<variant>.apk
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const variant = process.argv[2] === 'release' ? 'release' : 'debug'
const url = (process.env.CAP_SERVER_URL || '').replace(/\/+$/, '')

if (!/^https?:\/\/[^/]+/.test(url)) {
  console.error('Defina CAP_SERVER_URL com o URL de produção, ex.: CAP_SERVER_URL=https://app.minhaagencia.com npm run apk:debug')
  process.exit(1)
}

// Android Studio ships a JDK; use it when JAVA_HOME isn't set.
const env = { ...process.env }
if (!env.JAVA_HOME) {
  const jbr = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  if (existsSync(jbr)) env.JAVA_HOME = jbr
}
if (!env.ANDROID_HOME && process.env.LOCALAPPDATA) {
  const sdk = join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  if (existsSync(sdk)) env.ANDROID_HOME = sdk
}

// The offline screen needs to know where to reconnect.
writeFileSync(join(root, 'www', 'config.js'), `window.AGENCYOS_URL = ${JSON.stringify(url)}\n`)

const run = (cmd, cwd = root) => execSync(cmd, { cwd, env, stdio: 'inherit' })
run('npx cap sync android')
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const gradleCmd = process.platform === 'win32' ? `"${join(root, 'android', gradle)}"` : gradle
run(`${gradleCmd} ${variant === 'release' ? 'assembleRelease' : 'assembleDebug'}`, join(root, 'android'))

const built = join(root, 'android', 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`)
mkdirSync(join(root, 'dist'), { recursive: true })
const out = join(root, 'dist', `AgencyOS-${variant}.apk`)
copyFileSync(built, out)
console.log(`\nAPK pronto: ${out}\nServidor: ${url}`)
