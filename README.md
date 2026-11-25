# Spillover

Catch the localization bugs that only show up on screen. Kane CLI checks every locale of your app in real Chrome, your coding agent fixes what breaks, and Kane proves the fix.

Coding agents can translate an app into ten languages in minutes. Nobody checks what the translated app actually looks like. German labels run about 35% longer and spill out of their buttons. Arabic pages render left-to-right. Prices show `€1,399.00` in Berlin and `₹124,999.00` in Mumbai, where people expect `1.399,00 €` and `₹1,24,999.00`. Missing keys quietly fall back to English. The HTML looks fine, unit tests pass and the text diff is clean. The bug only exists on screen.

## What it catches

On the included demo store, one run of `spillover check` finds seven real bugs across four locales:

| Locale | Bug | How Kane caught it |
|---|---|---|
| de | Checkout button reads "Zur Kasse gehe" | Vision check: label clipped by the button edge |
| de | Price `€1,399.00` | Read the price off the page, expected `1.399,00 €` |
| hi | Price `₹124,999.00` | Read the price, expected lakh grouping `₹1,24,999.00` |
| ar | Page laid out left-to-right | Vision check: heading starts on the wrong side |
| ar | Price `AED 5,499.00` | Read the price, expected `5,499.00 د.إ.` |
| ja | Shipping note in English | Read the English source text on screen |
| ja | Checkout button in English | Read the English source text on screen |

The 14 checks that should pass all passed. No false alarms.

## The loop

```
spillover loop

Round 1: verify    Kane checks de, ar, hi, ja in parallel     7 bugs in 4 locales
Round 1: fix       Claude Code reads the brief, fixes causes  4 files changed
Round 2: verify    Kane re-checks only the broken locales     all 21 checks pass
```

The agent fixed root causes, not symptoms: one `Intl.NumberFormat` change fixed three locales' prices, `dir="rtl"` fixed Arabic, the fixed button width came out, and Japanese got its two missing strings. The agent couldn't run anything itself. Kane was the only thing that proved the fixes worked.

A recorded run is in [`examples/`](examples): the [terminal output](examples/loop-run.txt), the [brief Kane's verdicts produced](examples/brief.md), the [agent's diff](examples/agent-fix.diff) and the [final report](examples/report-after-fix.json).

## Install

You need Node 18+, Google Chrome and a free [TestMu AI](https://www.testmuai.com) account.

```bash
npm install -g @testmuai/kane-cli github:mystiquemide/kane-cli-hack
kane-cli login
spillover demo
```

`spillover demo` copies a sample store with real localization bugs into `./spillover-demo` and checks it, so you can see what Spillover catches before pointing it at your own app.

## Use it on your app

```bash
cd your-app
spillover init --url "http://localhost:3000/?lang={locale}"
spillover doctor
spillover check
spillover loop
```

- `init` finds your translation files (`locales/de.json`, `public/locales/de/common.json` and similar), detects right-to-left languages and price fields, and writes `spillover.config.json`.
- `doctor` checks Chrome, Kane CLI, your sign-in and your credits, and tells you how to fix anything missing.
- `check` finds the bugs. It confirms your app is running before it spends any Kane credits.
- `loop` hands the bugs to Claude Code and re-checks until every language passes. Use any other agent that reads a prompt on stdin with `--agent "<command>"`.

Exit codes: `0` every locale passes, `1` a locale is broken, `2` setup error. Put `spillover check` in CI as is.

Each language costs a few Kane credits per check.

## How it works

1. Spillover opens one real Chrome per locale and loads your page.
2. It builds checks from your translation catalogs: each key string, the price formatted with `Intl.NumberFormat` for that locale, every label fully visible, and right-to-left layout for RTL locales.
3. Kane CLI attaches to each browser over CDP and judges the page in analyzer mode with visual assertions (`kane-cli run --analyzer-only --assertion-mode visual --cdp-endpoint ...`). Kane reads the text and prices off the screen and uses vision for clipping and direction.
4. Spillover compares what Kane read against the catalog, ignoring spacing and invisible direction marks, so formatting noise doesn't raise false alarms.
5. Failures go into `.spillover/brief.md` with Kane's reasoning and a screenshot per locale. `spillover loop` hands the brief to your agent and re-checks only the locales that failed.

## Config

`spillover init` writes this for you. To point Kane at exact spots on the page, add `strings`:

```json
{
  "url": "http://localhost:3000/?lang={locale}",
  "catalog": "src/locales/{locale}.json",
  "source": "en",
  "locales": {
    "de": { "intl": "de-DE" },
    "ar": { "intl": "ar-AE", "dir": "rtl" },
    "hi": { "intl": "hi-IN" }
  },
  "strings": {
    "cart.title": "main page heading",
    "cart.checkout": "checkout button"
  },
  "price": { "key": "price", "element": "product price on the item card" }
}
```

`strings` maps catalog keys to a plain-English description of where they appear. Without it, Spillover picks a few visible strings and Kane looks for them anywhere on the page. Set `serve` to a folder and Spillover hosts a static app for you.

## Limits

- One page per check. Multi-step flows per locale are next.
- Prices need `amount` and `currency` in the catalog.
- Each locale costs a few Kane credits per check.

## License

MIT
