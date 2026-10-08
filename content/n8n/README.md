# n8n series assets

`diagrams/` — eight original SVG diagrams, one per article, plus `captions.md`
(Arabic caption + Arabic alt text per diagram).

**Why we draw our own.** n8n is licensed under the Sustainable Use License, not
MIT. Its terms restrict use to "your own internal business purposes or for
non-commercial or personal use". Copying its UI screenshots into a commercial
page with a service CTA is not that, so the diagrams are constructed from
scratch with our own palette and plain geometry. `make_diagrams.py` is the
generator — edit the layout functions and re-run rather than hand-editing SVG.

Regenerate:

```bash
python3 content/n8n/make_diagrams.py
```

Visual check needs a real renderer: ImageMagick on this machine falls back to
its own MSVG renderer, which drops Arabic shaping and `fill="none"`. Use Chrome,
which is what the site actually uses:

```bash
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1200,560 \
  --screenshot=/tmp/d3.png "file://$PWD/content/n8n/diagrams/d3.svg"
```

The upload API rejects `image/svg+xml`, so diagrams are rasterised to PNG before
upload. See `.github/workflows/upload-series-images.yml`.
