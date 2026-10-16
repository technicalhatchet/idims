# TechDeck brand files

All lettering is converted to shapes, so nothing depends on Exo 2 being installed.

## Files

| File | Use |
|---|---|
| `apple-touch-icon.png` (180) | iPhone/iPad home screen icon |
| `icon-192.png`, `icon-512.png` | PWA manifest icons |
| `techdeck-icon.svg` | Master app icon (square — iOS rounds the corners itself) |
| `favicon.svg` | Browser tab icon (Safari, Chrome, Firefox all support SVG) |
| `favicon-32.png`, `favicon-16.png`, `favicon.ico` | Fallbacks for older browsers |
| `techdeck-lockup.svg` / `.png` | Icon + wordmark, for dark backgrounds (site header) |
| `techdeck-lockup-light.svg` / `.png` | Icon + wordmark, for white backgrounds (invoices, paperwork) |
| `techdeck-wordmark.svg` | Wordmark only, dark backgrounds |
| `techdeck-wordmark-light.svg` | Wordmark only, white backgrounds |

## Drop into `<head>`

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0A0D14">
```

## Manifest icons

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
]
```

## Colors (matched to the TechDeck UI)

- Cyan: `#67E8F9` → `#06B6D4` (centered on the app accent `#22D3EE`)
- Orange: `#FDBA74` → `#FF7A00` (matches app accents `#FB923C` / `#FF7A00`)
- Background: `#121B2C` → `#05080F`
- On white: blue `#0A7FC4`, orange `#D27000`
- Wordmark font: Exo 2 ExtraBold Italic, custom D. Monogram: Exo 2 Black Italic T, custom D.
