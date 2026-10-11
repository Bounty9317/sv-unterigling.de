// Erzeugt Favicons, App-Icons, das Link-Vorschaubild (Open Graph) und das PDF-Logo.
// Einmalig ausführen, wenn sich Logo oder Titelbild ändern:  node scripts/make-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('..', import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));

const LOGO = path('src/assets/images/logo.png');
const HERO = path('src/assets/images/gasthaus-lamm.jpg');
const CREAM = '#f6efd6';

// Zielscheibe als Favicon – bleibt auch in 16 px erkennbar.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1f4d33"/>
  <circle cx="32" cy="32" r="23" fill="${CREAM}"/>
  <circle cx="32" cy="32" r="16.5" fill="none" stroke="#1f4d33" stroke-width="3.5"/>
  <circle cx="32" cy="32" r="9.5" fill="#1f4d33"/>
  <circle cx="32" cy="32" r="3.5" fill="${CREAM}"/>
</svg>
`;

await mkdir(path('public/icons'), { recursive: true });
await mkdir(path('public/images'), { recursive: true });

await writeFile(path('public/favicon.svg'), faviconSvg);
await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toFile(path('public/favicon-32.png'));

async function logoOnSquare(size, padding, file) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(LOGO).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ palette: true, colors: 128 })
    .toFile(file);
}

await logoOnSquare(180, 0.06, path('public/apple-touch-icon.png'));
await logoOnSquare(192, 0.06, path('public/icons/icon-192.png'));
await logoOnSquare(512, 0.06, path('public/icons/icon-512.png'));
// „maskable“: Android schneidet Icons rund zu – deshalb mehr Rand.
await logoOnSquare(512, 0.16, path('public/icons/icon-maskable-512.png'));

// Logo für die PDF-Listen (klein halten, wird in jede PDF eingebettet)
await sharp(LOGO)
  .resize({ width: 480 })
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(path('public/images/logo-pdf.jpg'));

// Vorschaubild für geteilte Links (1200 × 630)
const gradient = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.35" stop-color="#0d1f15" stop-opacity="0"/>
    <stop offset="1" stop-color="#0d1f15" stop-opacity="0.85"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
</svg>`);
const ogLogo = await sharp(LOGO).resize({ width: 420 }).toBuffer();
await sharp(HERO)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([
    { input: gradient, top: 0, left: 0 },
    { input: ogLogo, left: 60, top: 630 - 60 - Math.round(420 / 1.664) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path('public/images/og-image.jpg'));

console.log('Icons und Vorschaubilder erzeugt.');
