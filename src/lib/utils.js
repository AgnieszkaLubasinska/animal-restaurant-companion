export function toNumber(value) {
  const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function formatNumber(value) {
  const number = toNumber(value);
  if (!number) return "";
  return new Intl.NumberFormat("pl-PL", {
    notation: number > 999999 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(number);
}

export function getRoi(item) {
  const price = toNumber(item.price);
  const cod = toNumber(item.cod);
  return price && cod ? price / cod : null;
}
