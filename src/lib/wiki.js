function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeBadName(name) {
  return !name || name.length < 2 || name.length > 90 || /^(File|Image):/.test(name) || name.includes("Edit");
}

export async function fetchWikiPage(pageName) {
  const url = `https://animalrestaurant.fandom.com/api.php?action=parse&format=json&origin=*&prop=text&page=${encodeURIComponent(pageName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const html = data?.parse?.text?.["*"] || "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const items = new Map();

  doc.querySelectorAll("table tr").forEach((row) => {
    const cells = [...row.querySelectorAll("td")];
    if (!cells.length) return;

    let name = [...row.querySelectorAll("a[title]")]
      .map((a) => a.getAttribute("title"))
      .find((title) => title && !looksLikeBadName(title));

    if (!name) name = clean(cells[0]?.innerText || "");
    name = clean(name);
    if (looksLikeBadName(name)) return;

    const rowText = clean(cells.map((cell) => cell.innerText).join(" | "));
    const price = rowText.match(/[\d,.]+\s*(?:cod|Cod|COD)/)?.[0] || "";
    const stars = rowText.match(/[\d,.]+\s*(?:★|stars?)/i)?.[0] || "";

    items.set(name, { name, price, stars, source: pageName });
  });

  if (items.size < 5) {
    doc.querySelectorAll("li a[title], h2 .mw-headline, h3 .mw-headline").forEach((element) => {
      const name = clean(element.getAttribute("title") || element.textContent);
      if (!looksLikeBadName(name)) items.set(name, { name, source: pageName });
    });
  }

  return [...items.values()];
}

export async function syncCategory(category, existingItems) {
  const map = new Map(existingItems.map((item) => [item.name, item]));
  const errors = [];

  for (const page of category.wikiPages) {
    try {
      const fetchedItems = await fetchWikiPage(page);
      for (const item of fetchedItems) map.set(item.name, { ...map.get(item.name), ...item });
    } catch (error) {
      errors.push(`${page}: ${error.message}`);
    }
  }

  return { items: [...map.values()], errors };
}
