# Handoff: Portfolioyun — Welcome & Login (v4, dark)

## Overview
Two authentication screens for **Portfolioyun**, a Turkish stock/fund/crypto investing app: a **Welcome (splash)** screen and a **Login** screen. Both are dark-mode, mobile-first (390 × 844, iPhone-class), with an animated financial-chart texture behind the content. Language: Turkish. Copy in this document is final — use it verbatim.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React Native, SwiftUI, Kotlin/Compose, React web, etc.) using its established patterns, component library, and navigation. If no environment exists yet, pick the framework that fits the product (a native or React Native mobile app is the natural target) and implement there.

`Login Screen v4.dc.html` is a single page rendering **both phone frames side by side** for review. In the real app they are **two separate routes/screens**.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, animation timings and copy are final. Recreate pixel-faithfully, substituting the codebase's own primitives (buttons, text fields) where they can carry these values.

---

## Screens / Views

### 1. Welcome (`/welcome`) — app entry
**Purpose:** First launch. Present the brand and route the user to sign-up or login.

**Layout** — root: 390 × 844, background `#111112`, `border-radius: 38px` (device frame only — drop the radius in a real app), `overflow: hidden`, `position: relative`, column flex.
- Absolute full-bleed background SVG (see *Background texture*), `pointer-events: none`, sits behind everything.
- **Status bar** — `padding: 18px 30px 0`, row, space-between, 12px/600. Left `09:41`, right wifi + battery Lucide icons at `opacity: .7`. Mock chrome only; use the platform status bar.
- **Content column** — `flex: 1`, `padding: 0 26px`, column.
  - **Hero block** — `flex: 1`, centered vertically, items flush left:
    - `h1` **"Portfolioyun"** — Archivo 700, 46px, line-height .98, letter-spacing −.04em, `#f5f4f3`.
    - Paragraph — 16px/1.45, `rgba(245,244,243,.55)`, `max-width: 270px`, margin-top 16px: *"Hisse, fon ve kripto tek portföyde. Komisyonsuz ilk 30 gün."*
    - Trust row — margin-top 26px, flex, gap 20px, Archivo 12px, letter-spacing .04em, `rgba(245,244,243,.45)`; each item is a 13px green (`#43b56f`) Lucide icon + label: `shield` **"SPK lisanslı"**, `clock` **"7/24 emir"**.
  - **Action block** — `padding-bottom: 24px`, column, gap 10px:
    - Primary **"Hesap aç"** → sign-up. Height 58, `border-radius: 29px`, bg `#f5f4f3`, text `#111112`, Archivo 600 16px, centered label + 19px `arrow-right`. Hover: bg `#ec3013`, text `#fff`, `transition: background .18s, color .18s`.
    - Secondary **"Giriş yap"** → Login. Height 58, radius 29, transparent, `1px solid rgba(245,244,243,.18)`, text `#f5f4f3`. Hover: border `rgba(245,244,243,.45)`, bg `rgba(245,244,243,.06)`.
    - Legal note — centered, 12px/1.5, `rgba(245,244,243,.35)`, margin-top 10px: *"Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul edersiniz."*
    - Home indicator — 134 × 5, radius 3, `rgba(245,244,243,.28)`, centered, margin-top 14px (mock chrome).

### 2. Login (`/login`)
**Purpose:** Return user signs in with email + password, or with Apple / Google.

Same frame, status bar and background system as Welcome. Content column `padding: 0 26px`.
- **Brand row** — `padding: 44px 0 0`, flex, gap 9px: 9px `#ec3013` dot (`border-radius: 50%`) + **"PORTFOLIOYUN"** in Archivo 700, 12px, letter-spacing .26em.
- **Hero** — `padding: 40px 0 0`:
  - `h1` **"Tekrar<br>hoş geldiniz."** — Archivo 700, 42px, line-height 1, letter-spacing −.035em.
  - Sub — 15px, `rgba(245,244,243,.5)`, margin-top 18px: *"Portföyünüz sizi bekliyor."*
  - Quote row — margin-top 16px, gap 18px, Archivo 12px, letter-spacing .04em. Up-chevron polyline + **"THYAO +1,86%"** in `#43b56f`; down-chevron + **"ASELS −0,42%"** in `#ec3013` (note the true minus sign `−`). Icons 12px, stroke 2.6.
- **Form** — margin-top 28px, column, gap 12px:
  - Field shell: height 58, `padding: 0 20px`, `border-radius: 16px`, bg `rgba(245,244,243,.06)`, `1px solid rgba(245,244,243,.09)`. Focus: border `rgba(245,244,243,.4)`.
  - Input: transparent, no border, 16px body font, color `#f5f4f3`; placeholder `rgba(245,244,243,.32)`. Placeholders **"E-posta adresi"**, **"Şifre"**.
  - Password field has a trailing eye button (19px Lucide `eye`, `rgba(245,244,243,.45)`, hover `#ec3013`, `aria-label="Şifreyi göster"`) toggling `type` between `password` and `text`.
  - **Error row** (conditional) — 13px `#ff8a72`, flex gap 8px, leading 5px `#ec3013` dot.
  - Primary CTA — margin-top 6px, height 58, radius 29, bg `#f5f4f3`, text `#111112`, Archivo 600 16px, centered label + 19px `arrow-right`. Hover bg `#ec3013` / text `#fff`. Label: **"Giriş yap"** → **"Doğrulanıyor…"** while pending → **"Giriş başarılı"** on success.
  - **"Şifremi unuttum"** — centered, 13px, `rgba(245,244,243,.5)`, 8px padding.
- **Footer block** — `margin-top: auto`, `padding-bottom: 24px`:
  - Divider row — two 1px `rgba(245,244,243,.14)` rules with centered **"VEYA"** (11px, letter-spacing .18em, `rgba(245,244,243,.4)`), gap 16px, margin-bottom 16px.
  - Two OAuth buttons, column, gap 10px, each height 56, radius 28, transparent, `1px solid rgba(245,244,243,.18)`, Archivo 600 15px, centered 18px brand glyph + label, gap 10px. Hover: border `rgba(245,244,243,.45)`, bg `rgba(245,244,243,.06)`.
    - **"Apple ile devam et"** — monochrome Apple mark in `currentColor`.
    - **"Google ile devam et"** — official 4-color G (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`).
    - Use the platform's native buttons (Sign in with Apple / Google Sign-In) where the SDK requires it; match these dimensions.
  - Sign-up row — centered, margin-top 20px, 13px, gap 5px: *"Hesabınız yok mu?"* in `rgba(245,244,243,.5)` + link **"Hesap aç"** (600, `#f5f4f3`, hover `#ec3013`).
  - Home indicator, as on Welcome, margin-top 22px.

---

## Background texture
A single absolutely-positioned SVG (`viewBox="0 0 390 844"`, full size, `pointer-events: none`) behind each screen's content. It must read as **texture, never foreground** — nothing in it exceeds ~50% effective opacity, and no element sits over a headline at full strength. Both screens use the same vocabulary with different placements.

Layers, back to front:
1. **Grid** — horizontal rules at y = 150, 290, 430, 570, 710 and vertical rules at x = 98, 196, 294, `stroke: rgba(245,244,243,.04)`, 1px.
2. **Scattered sparklines** — 6–8 short 5-segment polylines, `stroke-width: 1.6`, round caps/joins, each rotated between −26° and +20° and placed in the margins. Green `#43b56f` for up-trends, red `#ec3013` for down-trends; per-path opacity .34–.55. The whole group animates `breathe` (see below).
3. **Candlesticks** — two small groups (3 and 2 candles), `stroke-width: 1.2`, rotated −18° / +12°. Green candles filled, red candles hollow. Group animates `glow`.
4. **Volume bars** — 4 rects 6px wide, varying heights, `fill: rgba(245,244,243,.07)`, rotated −14°.
5. **Ticker labels** — Archivo 9px, letter-spacing 1.6, `fill: rgba(245,244,243,.08)`, rotated −16°…+14°: `XU100`, `BIST`, `USD/TRY`, `XAU`.
6. **Floaters** — 4 small chevron marks (3 green up, 1 red down) drifting upward on `floatUp`, durations 11/13/14/16s with negative delays so they are out of phase.
7. **Long trace line** — one wide sparkline, `stroke: #43b56f`, `opacity: .16`, `stroke-dasharray: 260`, animating `trace` (draws in, then out) over 9s.

### Keyframes
```css
@keyframes floatUp { 0%{transform:translateY(46px);opacity:0} 18%{opacity:.55} 78%{opacity:.4} 100%{transform:translateY(-84px);opacity:0} }
@keyframes glow    { 0%,100%{opacity:.2}  50%{opacity:.42} }
@keyframes breathe { 0%,100%{opacity:.3}  50%{opacity:.85} }
@keyframes trace   { 0%{stroke-dashoffset:260} 55%{stroke-dashoffset:0} 100%{stroke-dashoffset:-260} }
```
Durations: `breathe` 6.5s, `glow` 6–7.5s (staggered delays), `floatUp` 11–16s, `trace` 9s — all `ease-in-out` (floatUp `linear`) and infinite. Honour `prefers-reduced-motion: reduce` by freezing all four at their mid state.

---

## Interactions & Behavior
- **Welcome → "Hesap aç"** opens sign-up; **"Giriş yap"** opens Login. Legal links open Terms / Privacy.
- **Login submit** validates locally, then calls the auth API:
  - email must match `/^[^@\s]+@[^@\s]+\.[^@\s]+$/` → error *"Geçerli bir e-posta adresi girin."*
  - password length ≥ 6 → error *"Şifre en az 6 karakter olmalı."*
  - Errors clear on any keystroke in either field.
  - While pending, CTA label becomes *"Doğrulanıyor…"*; the prototype resolves after 900ms and shows *"Giriş başarılı"*. Real implementation: disable the button while pending and navigate to the portfolio on success; surface server errors in the same error row.
- **OAuth** — prototype shows *"Google ile bağlanıldı"* / *"Apple ile bağlanıldı"* in the CTA after 900ms. Real implementation: run the provider flow, then the same success navigation.
- **Password toggle** switches input type; the icon stays in place.
- **Hover/focus** as specified per component. Focus visible must be themed, not the browser default — 2px `#ec3013` outline, 2px offset — per the Modernist system.
- Touch targets: every button is ≥ 56px tall; the eye toggle should get a ≥ 44px hit area even though its glyph is 19px.

## State Management
| State | Type | Notes |
|---|---|---|
| `email` | string | controlled input |
| `pw` | string | controlled input |
| `show` | boolean | password visibility |
| `error` | string | "" = hidden; set by validation or API failure |
| `loading` | boolean | drives *"Doğrulanıyor…"* and disables submit |
| `done` | string | success label; replace with navigation in production |

Transitions: typing clears `error`; submit → validate → (`error`) or (`loading: true` → API → `loading: false` + navigate).

## Design Tokens
**Color**
| Token | Value | Use |
|---|---|---|
| Surface | `#111112` | screen background |
| Page behind frame | `#0a0a0b` | review canvas only |
| Ink | `#f5f4f3` | primary text, primary button fill |
| Ink 55/50/45/35% | `rgba(245,244,243,.55 / .5 / .45 / .35)` | body, secondary, tertiary text |
| Field fill | `rgba(245,244,243,.06)` | inputs, ghost hover |
| Hairline | `rgba(245,244,243,.09 / .14 / .18)` | field border, divider, button border |
| Accent (loss/brand) | `#ec3013` | logo mark, hover fill, down-trends |
| Error text | `#ff8a72` | error row |
| Gain | `#43b56f` | up-trends, trust icons |
| Chart green (bg) | `#43b56f` | background sparklines |

**Type** — Archivo throughout (`--font-heading` / `--font-body`, Modernist). Display 46/700/−.04em · H1 42/700/−.035em · Button 16/600 · Body 16 · Secondary 15 · Small 13 · Micro 12/600 (.04–.26em tracking) · Nano 11 (.18em) / 9 (1.6px tracking, chart labels).

**Spacing** — screen gutter 26px; block gaps 10 / 12 / 16 / 18 / 26 / 28 / 40 / 44px; bottom padding 24px.

**Radius** — frame 38 · app mark 22 · field 16 · pill buttons 28–29 · home indicator 3.

**Sizing** — frame 390 × 844 · primary/secondary buttons h58 · OAuth h56 · fields h58 · app mark 72.

**Shadow** — none. Depth comes from surface tint only.

**Motion** — hover transitions `.18s`; background loops 6.5–16s as tabled above.

## Assets
- **Icons:** Lucide (`trending-up`, `shield`, `clock`, `eye`, `arrow-right`, `wifi`, `battery`, chevrons) — inline SVG in the prototype, `stroke-width` 1.8–2.6. Use the codebase's Lucide package.
- **Brand glyphs:** Apple mark (monochrome, `currentColor`) and Google G (4-colour) are inlined in the HTML — replace with the official SDK buttons/assets and follow each provider's brand guidelines.
- **No raster images.** The background is pure SVG.
- **Design system:** Modernist (Archivo, `#ec3013` accent). `_ds/modernist-…/styles.css` carries the tokens; `readme.md` is its guide. Note these screens deliberately depart from the system's zero-radius rule — rounded fields and pill buttons were requested for the mobile app.

## Files
| File | What it is |
|---|---|
| `Login Screen v4.dc.html` | The design — both screens side by side. Open in a browser. |
| `support.js` | Runtime the prototype needs to render. Not for production. |
| `_ds/modernist-…/styles.css` | Design-system tokens (`--color-*`, `--font-*`, `--space-*`). |
| `_ds/modernist-…/_ds_bundle.js` | Design-system component bundle. |
| `_ds/modernist-…/readme.md` | Design-system guide. |
| `screens/01-welcome.png` | Welcome screen render (2×, 780 × 1688). |
| `screens/02-login.png` | Login screen render (2×, 780 × 1688). |

Earlier explorations (`Login Screen.dc.html`, `v2`, `v3`) stay in the source project and are **not** part of this handoff — v4 is the design to build.
