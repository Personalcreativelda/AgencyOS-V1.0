/**
 * Save a part of the page as a PDF inside the Android app.
 *
 * The app's WebView has no print dialog (window.print() does nothing there), so we render the
 * element to an A4 PDF in the page itself and write it to the phone's Documents/AgencyOS folder
 * with the Capacitor Filesystem plugin, then open the share sheet (WhatsApp, Drive, e-mail…).
 * In a normal browser the caller keeps using window.print(), which gives selectable text.
 */
export function isNativeApp() {
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

function plugin(name: string): any {
  return (window as any).Capacitor?.Plugins?.[name]
}

export async function saveElementAsPdf(element: HTMLElement, fileName: string): Promise<{ savedTo: string | null }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])

  document.documentElement.classList.add('pdf-export')
  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(element, {
      scale: Math.min(2, window.devicePixelRatio || 2),
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(element.scrollWidth, 760),
    })
  } finally {
    document.documentElement.classList.remove('pdf-export')
  }

  // A4 portrait with 10mm margins; the long image is cut into page-height slices.
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const margin = 10
  const pageW = pdf.internal.pageSize.getWidth() - margin * 2
  const pageH = pdf.internal.pageSize.getHeight() - margin * 2
  const sliceHeightPx = Math.floor((pageH / pageW) * canvas.width)
  for (let y = 0, page = 0; y < canvas.height; y += sliceHeightPx, page++) {
    const h = Math.min(sliceHeightPx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = h
    slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    if (page > 0) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, (h / canvas.width) * pageW)
  }

  const safeName = `${fileName.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'relatorio'}.pdf`

  if (!isNativeApp()) {
    pdf.save(safeName)
    return { savedTo: null }
  }

  const Filesystem = plugin('Filesystem')
  const Share = plugin('Share')
  const data = pdf.output('datauristring').split(',')[1]
  let uri: string | null = null
  let savedTo: string | null = null
  try {
    // Public Documents folder: visible in the phone's Files app.
    const res = await Filesystem.writeFile({ path: `AgencyOS/${safeName}`, data, directory: 'DOCUMENTS', recursive: true })
    uri = res.uri
    savedTo = `Documentos/AgencyOS/${safeName}`
  } catch {
    // Some Android versions refuse public folders: keep a private copy and share it instead.
    const res = await Filesystem.writeFile({ path: safeName, data, directory: 'CACHE', recursive: true })
    uri = res.uri
  }
  if (Share?.share && uri) {
    await Promise.resolve(Share.share({ title: safeName, files: [uri], dialogTitle: 'Guardar ou partilhar relatório' })).catch(() => {})
  }
  return { savedTo }
}
