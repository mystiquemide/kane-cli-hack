# Spillover: localization bugs found by Kane CLI

Kane CLI opened each locale in real Chrome and judged what was on screen.
Fix the app so every check below passes. Fix root causes (formatting code, CSS, document direction, missing catalog keys) rather than patching one locale at a time.

App catalogs: `demo-app/locales/{locale}.json`
Only edit files under: `demo-app/`
Do not edit spillover.config.json.

## de (http://127.0.0.1:4173/?lang=de)

- **product price on the right side of the item card**: Price is not formatted for this locale. Expected "1.399,00 €", screen shows "€1,399.00".
  - Kane: Reading the product price from the item card: value: '€1,399.00' -> '€1,399.00' after ['strip']; equals '1.399,00 €' -> FAIL
- **button and link labels**: A button label is cut off on screen. The translated text is wider than its button.
  - Kane: Checking button label visibility: value: 'false' -> 'false'; equals 'true' -> FAIL

Screenshot: `.spillover/de.png`

## ar (http://127.0.0.1:4173/?lang=ar)

- **product price on the right side of the item card**: Price is not formatted for this locale. Expected "5,499.00 د.إ.", screen shows "AED 5,499.00".
  - Kane: Reading the product price from the item card: value: 'AED 5,499.00' -> 'AED 5,499.00' after ['strip']; equals '5,499.00 د.إ.' -> FAIL
- **page direction**: The page is not laid out right-to-left. Set the document direction for RTL locales.
  - Kane: Checking right-to-left heading alignment: value: 'false' -> 'false'; equals 'true' -> FAIL

Screenshot: `.spillover/ar.png`

## hi (http://127.0.0.1:4173/?lang=hi)

- **product price on the right side of the item card**: Price is not formatted for this locale. Expected "₹1,24,999.00", screen shows "₹124,999.00".
  - Kane: Reading the product price from the item card: value: '₹124,999.00' -> '₹124,999.00' after ['strip']; equals '₹1,24,999.00' -> FAIL

Screenshot: `.spillover/hi.png`

## ja (http://127.0.0.1:4173/?lang=ja)

- **shipping note below the product**: Missing translation for "cart.shipping". The page shows the source text "Free shipping on orders over $50.".
  - Kane read the untranslated text on screen: Reading the shipping note below the product: value: 'Free shipping on orders over $50.' -> 'Free shipping on orders over $50.' after ['strip']; equals 'Free shipping on orders over $50.' -> PASS
- **orange checkout button**: Missing translation for "cart.checkout". The page shows the source text "Checkout".
  - Kane read the untranslated text on screen: Reading the checkout button label: value: 'Checkout' -> 'Checkout' after ['strip']; equals 'Checkout' -> PASS

Screenshot: `.spillover/ja.png`
