import sharp from 'sharp';

// Composites the client's real logo onto an AI-generated creative, bottom-left on a soft
// white badge card — so the brand mark is always pixel-accurate instead of the image model
// trying (and often failing) to redraw it from scratch.
export async function compositeLogoOntoImage(baseBuffer: Buffer, logoBuffer: Buffer): Promise<Buffer> {
  const base = sharp(baseBuffer);
  const baseMeta = await base.metadata();
  const canvasWidth = baseMeta.width || 1024;
  const canvasHeight = baseMeta.height || 1024;

  const logoTargetWidth = Math.round(Math.min(canvasWidth, canvasHeight) * 0.22);
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: logoTargetWidth, withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(resizedLogo).metadata();
  const logoWidth = logoMeta.width || logoTargetWidth;
  const logoHeight = logoMeta.height || logoTargetWidth;

  const padding = Math.round(canvasWidth * 0.045);
  const cardPad = Math.round(padding * 0.55);
  const cardWidth = logoWidth + cardPad * 2;
  const cardHeight = logoHeight + cardPad * 2;
  const cardRadius = Math.round(cardHeight * 0.22);

  const cardSvg = Buffer.from(
    `<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardWidth}" height="${cardHeight}" rx="${cardRadius}" ry="${cardRadius}" fill="#ffffff" fill-opacity="0.95"/>
    </svg>`
  );

  const left = padding;
  const top = canvasHeight - cardHeight - padding;

  return base
    .composite([
      { input: cardSvg, left, top },
      { input: resizedLogo, left: left + cardPad, top: top + cardPad },
    ])
    .png()
    .toBuffer();
}
