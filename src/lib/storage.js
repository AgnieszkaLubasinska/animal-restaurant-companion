import { categories, starterItems } from "../data/gameData.js";

const STORE_KEY = "animal-restaurant-companion-final-v1";

export function itemKey(categoryId, itemName) {
  return `${categoryId}::${itemName}`;
}

export function createInitialState() {
  const items = {};
  for (const category of categories) {
    items[category.id] = [...(starterItems[category.id] || [])];
  }
  return { items, owned: {}, wishlist: {}, updatedAt: null };
}

export function loadState() {
  const base = createInitialState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    const mergedItems = { ...base.items };

    for (const [categoryId, savedItems] of Object.entries(saved.items || {})) {
      const map = new Map((mergedItems[categoryId] || []).map((item) => [item.name, item]));
      for (const item of savedItems) map.set(item.name, { ...map.get(item.name), ...item });
      mergedItems[categoryId] = [...map.values()];
    }

    return { ...base, ...saved, items: mergedItems };
  } catch {
    return base;
  }
}

export function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(STORE_KEY);
}
