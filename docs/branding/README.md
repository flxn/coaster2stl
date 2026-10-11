# Coaster2STL icon

A coral coaster with an ivory C and stacked edges that suggest printed layers.
The square master has a transparent background and supplies the header, footer,
favicon and app icons.

- Original artwork: `coaster2stl-icon-master.png`
- Generation prompt: `prompt.txt`
- Header and footer: `public/coaster2stl-logo.png`, 256 px
- Browser icons: 16, 32, 48 and 64 px PNGs, plus a 16/32/48 px ICO
- App icons: 192 and 512 px PNGs
- Apple touch icon: 180 px with an opaque warm-white background

Created with the built-in imagegen tool on 2026-10-11. ImageMagick exports the
smaller files without changing the artwork or adding a CSS color filter.

To regenerate the assets, install ImageMagick and run from the repository root:

```sh
bash scripts/export-brand-icons.sh
npm run build
```

The header and footer share `siteConfig.logo`. Browser icon links live in
`index.html`; app icon links live in `vite/site-plugin.ts`. The `v=2` query on
existing icon URLs refreshes cached copies of the previous artwork.
