// Turns a locale catalog into the checks Kane CLI judges on the rendered page.

export function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

// Make strings comparable: unify spaces, drop bidi marks, fold full-width yen, trim.
export function normalize(value) {
  return String(value ?? "")
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, "")
    .replace(/[    ]/g, " ")
    .replace(/￥/g, "¥")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^['"“”‘’]+|['"“”‘’]+$/g, "")
    .trim();
}

export function expectedPrice(price, intlLocale) {
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency: price.currency }).format(price.amount);
}

// Leaf keys with short, human-readable values: what a user actually sees.
export function pickStrings(source, limit = 5, skip = []) {
  const out = [];
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (skip.some((s) => key === s || key.startsWith(`${s}.`))) continue;
      if (v && typeof v === "object") walk(v, key);
      else if (typeof v === "string" && v.length >= 3 && v.length <= 60 && /\p{L}{2}/u.test(v) && !/[{}<>]|https?:/.test(v) && !/^[A-Z]{3}$/.test(v)) out.push(key);
    }
  };
  walk(source, "");
  return out.slice(0, limit);
}

// Configured strings map keys to where they appear. With none configured,
// pick a few visible strings and let Kane look for them anywhere on the page.
function stringsToCheck(config, source) {
  if (config.strings && !Array.isArray(config.strings)) return config.strings;
  const keys = Array.isArray(config.strings) ? config.strings : pickStrings(source, 6, ["meta", config.price?.key].filter(Boolean));
  return Object.fromEntries(keys.map((k) => [k, null]));
}

// Build the list of checks for one locale.
// Each check has: id, kind, condition (sent to Kane), and what counts as a pass.
export function buildChecks({ locale, settings, catalog, source, config }) {
  const checks = [];

  for (const [key, description] of Object.entries(stringsToCheck(config, source))) {
    const translated = lookup(catalog, key);
    const sourceText = lookup(source, key);
    const where = description ? `The ${description}` : null;
    if (translated == null) {
      checks.push({
        id: `string:${key}`,
        kind: "untranslated",
        key,
        description: description || `text "${key}"`,
        expected: `a ${locale} translation`,
        sourceText,
        condition: where ? `${where} reads '${sourceText}'` : `The page shows the untranslated text '${sourceText}'`,
      });
    } else {
      checks.push({
        id: `string:${key}`,
        kind: "string",
        key,
        description: description || `text "${key}"`,
        expected: translated,
        condition: where ? `${where} reads '${translated}'` : `The page shows the text '${translated}'`,
      });
    }
  }

  if (config.price) {
    const price = lookup(catalog, config.price.key) || lookup(source, config.price.key);
    if (price) {
      const expected = expectedPrice(price, settings.intl || locale);
      checks.push({
        id: "price",
        kind: "price",
        key: config.price.key,
        description: config.price.element,
        expected,
        condition: `The ${config.price.element} reads '${normalize(expected)}'`,
      });
    }
  }

  checks.push({
    id: "fit",
    kind: "visual",
    description: "button and link labels",
    expected: "every label fully visible",
    failMessage: "A button label is cut off on screen. The translated text is wider than its button.",
    condition: "Every button label on the page is fully visible, with no words cut off or clipped by the button edge",
  });

  if (settings.dir === "rtl") {
    checks.push({
      id: "rtl",
      kind: "visual",
      description: "page direction",
      expected: "right-to-left layout",
      failMessage: "The page is not laid out right-to-left. Set the document direction for RTL locales.",
      condition: "The page is laid out right-to-left: the main heading starts at the right side of the content area, not the left",
    });
  }

  return checks;
}

const BOOLEAN = /^(true|false|yes|no)$/i;

// Decide pass or fail for one check from Kane's verdict.
// For text checks we compare the value Kane read off the screen ourselves,
// so formatting quirks (non-breaking spaces, bidi marks) don't cause false alarms.
export function judge(check, kaneResult, subCheck) {
  const seen = subCheck?.extracted_value;
  const readText = seen != null && !BOOLEAN.test(String(seen).trim()) ? normalize(seen) : null;

  if (check.kind === "untranslated") {
    const showsSource = readText != null ? readText === normalize(check.sourceText) : kaneResult === true;
    return {
      pass: false,
      actual: readText ?? (showsSource ? check.sourceText : "(missing key)"),
      reason: showsSource
        ? `Missing translation for "${check.key}". The page shows the source text "${check.sourceText}".`
        : `Missing translation for "${check.key}" in the catalog.`,
    };
  }

  if (check.kind === "string" || check.kind === "price") {
    const pass = readText != null ? readText === normalize(check.expected) : kaneResult === true;
    return {
      pass,
      actual: readText ?? (pass ? check.expected : "(different)"),
      reason: pass
        ? "matches"
        : check.kind === "price"
          ? `Price is not formatted for this locale. Expected "${normalize(check.expected)}", screen shows "${readText ?? "something else"}".`
          : `Text differs from the catalog. Expected "${check.expected}", screen shows "${readText ?? "something else"}".`,
    };
  }

  return {
    pass: kaneResult === true,
    actual: kaneResult === true ? check.expected : "failed on screen",
    reason: kaneResult === true ? "ok" : check.failMessage,
  };
}
