// Wordmark shown at the bottom of the Android 12+ launch screen (200x80dp max -> 800x320px @xxxhdpi).
import sharp from 'sharp'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320" viewBox="0 0 800 320">
  <text x="400" y="190" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="112" font-weight="700" letter-spacing="-3" fill="#ffffff">Agency<tspan fill="#C8FAD6">OS</tspan></text>
</svg>`
await sharp(Buffer.from(svg)).png().toFile(process.argv[2])
console.log('branding ok')
