# Fonts — Inter (OFL)

Bundled here so `satori` can render carousel slides fully offline (no network
fetch at render time, no dependency on Google Fonts availability at runtime).

## Files

- `Inter-Regular.ttf` — weight 400
- `Inter-Bold.ttf` — weight 700
- `OFL.txt` — SIL Open Font License 1.1 (applies to both files)

## Source & provenance

Inter ships from Google Fonts / the upstream `rsms/inter` project as a single
**variable** font (`Inter[opsz,wght].ttf`), not as separate static weight
files. `satori`'s text layout does not resolve variable-font weight axes on
its own, so the two static instances above were generated locally from the
official variable font:

1. Downloaded the variable font from the Google Fonts source-of-truth repo:
   `https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf`
2. Instantiated fixed-weight static fonts with `fonttools`
   (`fontTools.varLib.instancer.instantiateVariableFont`), pinning
   `wght=400` / `wght=700` and `opsz=14` (text optical size):

   ```python
   from fontTools.varLib.instancer import instantiateVariableFont
   from fontTools.ttLib import TTFont

   for weight, out in [(400, "Inter-Regular.ttf"), (700, "Inter-Bold.ttf")]:
       f = TTFont("Inter-Variable.ttf")
       instantiateVariableFont(f, {"wght": weight, "opsz": 14}, inplace=True)
       f.save(out)
   ```
3. `OFL.txt` copied verbatim from the same upstream directory.

## License

SIL Open Font License 1.1 — free to use, embed, and redistribute (including
in this repo and in rendered PNG output) as long as the font itself is not
sold on its own. See `OFL.txt`.

## Usage

Loaded once and cached by `lib/renderer.ts` (`loadFonts()`), then passed to
`satori()` as:

```ts
fonts: [
  { name: "Inter", data: interRegular, weight: 400, style: "normal" },
  { name: "Inter", data: interBold, weight: 700, style: "normal" },
]
```
