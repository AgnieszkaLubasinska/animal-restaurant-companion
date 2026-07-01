import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, RefreshCw, Plus, Star, Trash2, Upload, Search, ListChecks, BarChart3, Database } from "lucide-react";
import { categories } from "./data/gameData.js";
import { clearState, itemKey, loadState, saveState } from "./lib/storage.js";
import { syncCategory } from "./lib/wiki.js";
import { formatNumber, getRoi, toNumber } from "./lib/utils.js";
import "./styles.css";

function mergeItem(items, item) {
  const index = items.findIndex((current) => current.name === item.name);
  if (index >= 0) {
    const copy = [...items];
    copy[index] = { ...copy[index], ...item };
    return copy;
  }
  return [...items, item];
}

function App() {
  const [state, setState] = useState(loadState);
  const [categoryId, setCategoryId] = useState("facilities");
  const [status, setStatus] = useState("missing");
  const [sort, setSort] = useState("smart");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formItem, setFormItem] = useState(null);
  const [backupOpen, setBackupOpen] = useState(false);

  function commit(nextState) {
    setState(nextState);
    saveState(nextState);
  }

  const allItems = state.items[categoryId] || [];

  const stats = useMemo(() => {
    const owned = allItems.filter((item) => state.owned[itemKey(categoryId, item.name)]).length;
    const wishlist = allItems.filter((item) => state.wishlist[itemKey(categoryId, item.name)]).length;
    return {
      owned,
      total: allItems.length,
      wishlist,
      percent: allItems.length ? Math.round((owned / allItems.length) * 100) : 0
    };
  }, [allItems, state.owned, state.wishlist, categoryId]);

  const visibleItems = useMemo(() => {
    let items = [...allItems].filter((item) => {
      const key = itemKey(categoryId, item.name);
      const isOwned = !!state.owned[key];
      const isWishlist = !!state.wishlist[key];

      if (status === "owned" && !isOwned) return false;
      if (status === "missing" && isOwned) return false;
      if (status === "wishlist" && !isWishlist) return false;

      const text = [item.name, item.note, item.source].join(" ").toLowerCase();
      return !query.trim() || text.includes(query.toLowerCase());
    });

    items.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "priceAsc") return (toNumber(a.price) || Infinity) - (toNumber(b.price) || Infinity);
      if (sort === "codDesc") return toNumber(b.cod) - toNumber(a.cod);
      if (sort === "starsDesc") return toNumber(b.stars) - toNumber(a.stars);
      if (sort === "roiAsc") return (getRoi(a) ?? Infinity) - (getRoi(b) ?? Infinity);

      const aWishlistBoost = state.wishlist[itemKey(categoryId, a.name)] ? -1000000 : 0;
      const bWishlistBoost = state.wishlist[itemKey(categoryId, b.name)] ? -1000000 : 0;
      return (getRoi(a) ?? 999999) + aWishlistBoost - ((getRoi(b) ?? 999999) + bWishlistBoost);
    });

    if (view === "planner") {
      items = items.filter((item) => !state.owned[itemKey(categoryId, item.name)] && (item.price || item.cod || item.stars));
      items.sort((a, b) => (getRoi(a) ?? Infinity) - (getRoi(b) ?? Infinity));
      return items.slice(0, 12);
    }

    return items;
  }, [allItems, state, categoryId, status, query, sort, view]);

  async function handleSync() {
    setSyncing(true);
    setMessage("Synchronizuję dane z Animal Restaurant Wiki…");

    const next = { ...state, items: { ...state.items } };
    const errors = [];

    for (const category of categories) {
      const result = await syncCategory(category, next.items[category.id] || []);
      next.items[category.id] = result.items;
      errors.push(...result.errors);
    }

    next.updatedAt = Date.now();
    commit(next);
    setSyncing(false);
    setMessage(errors.length ? `Sync częściowy. Część stron Fandoma nie odpowiedziała.` : "Sync zakończony.");
  }

  function toggleOwned(item) {
    const key = itemKey(categoryId, item.name);
    commit({ ...state, owned: { ...state.owned, [key]: !state.owned[key] } });
  }

  function toggleWishlist(item) {
    const key = itemKey(categoryId, item.name);
    commit({ ...state, wishlist: { ...state.wishlist, [key]: !state.wishlist[key] } });
  }

  function saveItem(item) {
    const targetCategory = item.categoryId || categoryId;
    const nextItems = mergeItem(state.items[targetCategory] || [], {
      name: item.name.trim(),
      price: item.price.trim(),
      cod: item.cod.trim(),
      stars: item.stars.trim(),
      note: item.note.trim(),
      source: item.source || "manual"
    });
    commit({ ...state, items: { ...state.items, [targetCategory]: nextItems } });
    setCategoryId(targetCategory);
    setFormOpen(false);
    setFormItem(null);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "animal-restaurant-companion-backup.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  function importBackup(text) {
    try {
      const imported = JSON.parse(text);
      commit(imported);
      setBackupOpen(false);
      setMessage("Backup zaimportowany.");
    } catch {
      setMessage("Nieprawidłowy JSON.");
    }
  }

  function reset() {
    if (!confirm("Wyczyścić dane lokalne aplikacji?")) return;
    clearState();
    window.location.reload();
  }

  return (
    <div>
      <header className="top">
        <div>
          <h1>Animal Restaurant Companion</h1>
          <p>{state.updatedAt ? `Ostatni sync: ${new Date(state.updatedAt).toLocaleString("pl-PL")}` : "Checklisty, wishlist i planner zakupów"}</p>
        </div>
        <button onClick={() => alert("Na Androidzie: Chrome → menu ⋮ → Dodaj do ekranu głównego / Zainstaluj aplikację.")}>Instaluj</button>
      </header>

      <section className="panel">
        <label className="search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj itemu…" />
        </label>

        <div className="filters">
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="missing">Nieposiadane</option>
            <option value="all">Wszystkie</option>
            <option value="owned">Posiadane</option>
            <option value="wishlist">Wishlist</option>
          </select>

          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="smart">Najlepszy wybór</option>
            <option value="name">Nazwa A-Z</option>
            <option value="priceAsc">Najtańsze</option>
            <option value="codDesc">Największy cod/min</option>
            <option value="starsDesc">Najwięcej ⭐</option>
            <option value="roiAsc">Najlepsze ROI</option>
          </select>
        </div>

        <div className="actions">
          <button className="primary" onClick={handleSync} disabled={syncing}><RefreshCw size={17} /> {syncing ? "Sync…" : "Sync z Wiki"}</button>
          <button onClick={() => { setFormItem(null); setFormOpen(true); }}><Plus size={17} /> Dodaj item</button>
          <button onClick={() => setBackupOpen(true)}><Download size={17} /> Backup</button>
        </div>
      </section>

      <section className="stats">
        <div><strong>{stats.owned}</strong><span>posiadane</span></div>
        <div><strong>{stats.total}</strong><span>wszystkie</span></div>
        <div><strong>{stats.percent}%</strong><span>postęp</span></div>
        <div><strong>{stats.wishlist}</strong><span>wishlist</span></div>
      </section>

      {message && <section className="message">{message}</section>}

      {view === "planner" && (
        <section className="advisor">
          <h2>Planner zakupów</h2>
          <p>Pokazuje nieposiadane itemy z najlepszym znanym ROI. Im dokładniej uzupełnione cena i cod/min, tym lepszy ranking.</p>
        </section>
      )}

      <main>
        {visibleItems.length === 0 ? (
          <div className="empty">Brak itemów do pokazania.</div>
        ) : visibleItems.map((item) => {
          const key = itemKey(categoryId, item.name);
          const owned = !!state.owned[key];
          const wish = !!state.wishlist[key];
          const itemRoi = getRoi(item);

          return (
            <article className={`card ${owned ? "done" : ""}`} key={item.name}>
              <input type="checkbox" checked={owned} onChange={() => toggleOwned(item)} />
              <div className="cardMain">
                <h3>{item.name}</h3>
                {item.note && <p>{item.note}</p>}
                <div className="badges">
                  {item.price && <span>💰 {formatNumber(item.price)}</span>}
                  {item.cod && <span>Cod/min {formatNumber(item.cod)}</span>}
                  {item.stars && <span>⭐ {formatNumber(item.stars)}</span>}
                  {itemRoi && <span>ROI {formatNumber(itemRoi)} min</span>}
                  <span>{item.source || "manual"}</span>
                </div>
              </div>
              <div className="cardActions">
                <button onClick={() => toggleWishlist(item)} className={wish ? "starred" : ""}><Star size={18} fill={wish ? "currentColor" : "none"} /></button>
                <button onClick={() => { setFormItem({ ...item, categoryId }); setFormOpen(true); }}>✎</button>
              </div>
            </article>
          );
        })}
      </main>

      <nav className="bottom">
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><ListChecks size={18} /> Lista</button>
        <button className={view === "planner" ? "active" : ""} onClick={() => setView("planner")}><BarChart3 size={18} /> Planner</button>
        <button className={view === "data" ? "active" : ""} onClick={() => setView("data")}><Database size={18} /> Dane</button>
      </nav>

      {view === "data" && (
        <section className="dataPanel">
          {categories.map((category) => <div key={category.id}><strong>{category.label}</strong><span>{state.items[category.id]?.length || 0} itemów</span></div>)}
        </section>
      )}

      {formOpen && <ItemDialog item={formItem} defaultCategory={categoryId} onClose={() => setFormOpen(false)} onSave={saveItem} />}
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} onExport={exportBackup} onImport={importBackup} onReset={reset} />}
    </div>
  );
}

function ItemDialog({ item, defaultCategory, onClose, onSave }) {
  const [draft, setDraft] = useState({
    categoryId: item?.categoryId || defaultCategory,
    name: item?.name || "",
    price: item?.price || "",
    cod: item?.cod || "",
    stars: item?.stars || "",
    note: item?.note || "",
    source: item?.source || "manual"
  });

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="modal">
      <form className="dialog" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSave(draft); }}>
        <h2>Dodaj / edytuj item</h2>
        <select value={draft.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
        <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Nazwa" />
        <input value={draft.price} onChange={(event) => update("price", event.target.value)} placeholder="Cena cod" inputMode="numeric" />
        <input value={draft.cod} onChange={(event) => update("cod", event.target.value)} placeholder="Cod/min" inputMode="numeric" />
        <input value={draft.stars} onChange={(event) => update("stars", event.target.value)} placeholder="Stars" inputMode="numeric" />
        <textarea value={draft.note} onChange={(event) => update("note", event.target.value)} placeholder="Notatka / wymagania" />
        <div className="dialogActions">
          <button type="button" onClick={onClose}>Anuluj</button>
          <button className="primary">Zapisz</button>
        </div>
      </form>
    </div>
  );
}

function BackupDialog({ onClose, onExport, onImport, onReset }) {
  const [text, setText] = useState("");

  return (
    <div className="modal">
      <form className="dialog" onSubmit={(event) => event.preventDefault()}>
        <h2>Backup i import</h2>
        <p>Export zapisuje checkboxy, wishlistę i ręcznie dodane dane.</p>
        <button className="primary" onClick={onExport}><Download size={17} /> Pobierz backup JSON</button>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Wklej backup JSON tutaj" />
        <button onClick={() => onImport(text)}><Upload size={17} /> Importuj backup</button>
        <button className="danger" onClick={onReset}><Trash2 size={17} /> Wyczyść dane lokalne</button>
        <button onClick={onClose}>Zamknij</button>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
