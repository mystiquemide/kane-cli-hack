const LOCALES = { en: "English", de: "Deutsch", ar: "العربية", hi: "हिन्दी", ja: "日本語" };
const params = new URLSearchParams(location.search);
const lang = LOCALES[params.get("lang")] ? params.get("lang") : "en";

async function load(code) {
  const res = await fetch(`locales/${code}.json`);
  return res.json();
}

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node ? node[part] : undefined), dict);
}

function formatPrice(price) {
  return price.symbol + price.amount.toLocaleString("en-US", { minimumFractionDigits: price.decimals, maximumFractionDigits: price.decimals });
}

(async () => {
  const fallback = await load("en");
  const dict = lang === "en" ? fallback : await load(lang);

  document.documentElement.lang = lang;
  document.title = lookup(dict, "meta.title") || lookup(fallback, "meta.title");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = lookup(dict, key) ?? lookup(fallback, key);
  });

  document.getElementById("price").textContent = formatPrice(dict.price || fallback.price);

  const select = document.getElementById("lang");
  for (const [code, label] of Object.entries(LOCALES)) {
    const opt = new Option(label, code, false, code === lang);
    select.add(opt);
  }
  select.addEventListener("change", () => { location.search = `?lang=${select.value}`; });
})();
