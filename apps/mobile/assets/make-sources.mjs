// Renders the AgencyOS mark into the PNG sources that @capacitor/assets expects.
import sharp from 'sharp'
const mark = (rx) => `<path d="M11.5 29 20 11 28.5 29" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="23.6" r="2.4" fill="#C8FAD6"/>`
const svg = (body, size = 1024) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${body}</svg>`)
// Full icon (legacy launchers)
await sharp(svg(`<rect width="40" height="40" fill="#007867"/>${mark()}`)).png().toFile('assets/icon-only.png')
// Adaptive icon: foreground glyph kept inside the 66% safe zone, solid background
await sharp(svg(`<g transform="translate(20 20) scale(0.62) translate(-20 -20)">${mark()}</g>`)).png().toFile('assets/icon-foreground.png')
await sharp(svg(`<rect width="40" height="40" fill="#007867"/>`)).png().toFile('assets/icon-background.png')
// Splash (light + dark): centred mark on brand green
const splash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#007867"/><g transform="translate(1366 1366) scale(12) translate(-20 -20)">${mark()}</g></svg>`)
await sharp(splash).png().toFile('assets/splash.png')
await sharp(splash).png().toFile('assets/splash-dark.png')
console.log('sources ok')
