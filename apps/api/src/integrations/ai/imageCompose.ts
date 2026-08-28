import sharp from 'sharp';

// Composites the client's real logo onto an AI-generated creative, on a soft white badge card —
// so the brand mark is always pixel-accurate instead of the image model trying (and often
// failing) to redraw it from scratch.
//
// The corner is a FIXED bottom-left, matching exactly what the generation prompt tells the model
// (`logoNote`/`cornerAvoidance` in ai.controller.ts: "leave the bottom-left corner empty"). An
// earlier version picked whichever corner looked visually quietest *after* generation, but that
// analysis (region contrast/stdev) isn't reliable at detecting "there's headline text here" —
// it sometimes judged a text-covered corner as emptier than a busy photographic one and dropped
// the badge right on top of the headline. Keeping prompt and composite in lockstep on the same
// corner is what actually keeps the two from colliding.
export async function compositeLogoOntoImage(baseBuffer: Buffer, logoBuffer: Buffer): Promise<Buffer> {
  const base = sharp(baseBuffer);
  const baseMeta = await base.metadata();
  const canvasWidth = baseMeta.width || 1024;
  const canvasHeight = baseMeta.height || 1024;

  // Noticeably smaller than a typical hero element — a small corner mark, not a second focal
  // point competing with the headline (matches the reference creatives: compact top-aligned
  // logo lockup with generous surrounding negative space).
  const logoTargetWidth = Math.round(Math.min(canvasWidth, canvasHeight) * 0.13);
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: logoTargetWidth, withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(resizedLogo).metadata();
  const logoWidth = logoMeta.width || logoTargetWidth;
  const logoHeight = logoMeta.height || logoTargetWidth;

  const padding = Math.round(canvasWidth * 0.04);
  const cardPad = Math.round(padding * 0.55);
  const cardWidth = logoWidth + cardPad * 2;
  const cardHeight = logoHeight + cardPad * 2;
  const cardRadius = Math.round(cardHeight * 0.22);

  const left = padding;
  const top = canvasHeight - cardHeight - padding;

  const cardSvg = Buffer.from(
    `<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cardWidth}" height="${cardHeight}" rx="${cardRadius}" ry="${cardRadius}" fill="#ffffff" fill-opacity="0.95"/>
    </svg>`
  );

  return base
    .composite([
      { input: cardSvg, left, top },
      { input: resizedLogo, left: left + cardPad, top: top + cardPad },
    ])
    .png()
    .toBuffer();
}
