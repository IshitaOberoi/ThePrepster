// paste your key
const API_KEY = "ce31048c968f4a8cac0ca9731ba132ee";

const els = {
  grid: document.getElementById("recipesGrid"),
  loading: document.getElementById("loading"),
  error: document.getElementById("errorBox"),
  resultsMeta: document.getElementById("resultsMeta"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  discoverBtn: document.getElementById("discoverBtn"),
  mealPlan: document.getElementById("mealPlan"),
  clearPlanBtn: document.getElementById("clearPlanBtn"),
  groceries: document.getElementById("groceries"),
  clearGroceriesBtn: document.getElementById("clearGroceriesBtn")
};

let recipesCache = [];
let plan = new Map(); // recipeId -> { recipe, count }

init();

function init() {
  bindUI();
  discover(); // nice first impression
}

function bindUI() {
  els.searchBtn.addEventListener("click", () => {
    const q = (els.searchInput.value || "").trim();
    if (q.length > 0) { search(q); }
  });

  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = (els.searchInput.value || "").trim();
      if (q.length > 0) { search(q); }
    }
  });

  els.discoverBtn.addEventListener("click", () => { discover(); });
  els.clearPlanBtn.addEventListener("click", () => { plan.clear(); renderPlan(); renderGroceries(); });
  els.clearGroceriesBtn.addEventListener("click", () => { renderGroceries(true); });
}

/* ===== fetching ===== */

async function search(query) {
  showLoading(true);
  setMeta(`searching “${query}”…`);
  hideError();

  const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
  url.searchParams.set("query", query);
  url.searchParams.set("number", "12");
  url.searchParams.set("addRecipeInformation", "true");
  url.searchParams.set("fillIngredients", "true");
  url.searchParams.set("apiKey", API_KEY);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const items = Array.isArray(data.results) ? data.results : [];
    recipesCache = items;
    renderRecipes(items);
    setMeta(`${items.length} results`);
  } catch (_e) {
    showError();
  } finally {
    showLoading(false);
  }
}

async function discover() {
  showLoading(true);
  setMeta("discovering picks…");
  hideError();

  const url = new URL("https://api.spoonacular.com/recipes/random");
  url.searchParams.set("number", "12");
  url.searchParams.set("apiKey", API_KEY);

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    const items = Array.isArray(data.recipes) ? data.recipes : [];
    recipesCache = items;
    renderRecipes(items);
    setMeta(`showing ${items.length} picks`);
  } catch (_e) {
    showError();
  } finally {
    showLoading(false);
  }
}

/* ===== render recipes ===== */

function renderRecipes(list) {
  els.grid.innerHTML = "";

  if (!list || list.length === 0) {
    els.grid.innerHTML = `<div class="error">No recipes — try another search.</div>`;
    return;
  }

  list.forEach((r) => {
    const card = document.createElement("article");
    card.className = "card";
    const time = typeof r.readyInMinutes === "number" ? `${r.readyInMinutes} min` : "—";
    const servings = typeof r.servings === "number" ? `${r.servings} servings` : "—";
    const img = r.image || (r.imageUrls && r.imageUrls[0]) || "";

    card.innerHTML = `
      <div class="card__media">
        <img src="${img}" alt="${escapeHTML(r.title || r.name || "Recipe")}" loading="lazy"/>
      </div>
      <div class="card__body">
        <div class="card__title">${escapeHTML(r.title || r.name || "Untitled")}</div>
        <div class="badges">
          <span class="badge">${time}</span>
          <span class="badge">${servings}</span>
        </div>
        <div class="cta">
          <button class="button add-btn" data-id="${r.id || ""}">Add to Plan</button>
          <button class="button secondary preview-btn" data-id="${r.id || ""}">Preview</button>
        </div>
      </div>
    `;

    // Append first
    els.grid.appendChild(card);

    // Now attach button listeners safely
    card.querySelector(".add-btn").addEventListener("click", () => {
      addToPlan(r);
    });

    card.querySelector(".preview-btn").addEventListener("click", () => {
      previewRecipe(r);
    });

  });
}

function previewRecipe(r) {
  const modal = document.getElementById("previewModal");
  const title = document.getElementById("previewTitle");
  const img = document.getElementById("previewImage");

  // Set modal content
  title.textContent = r.title || "Recipe Preview";
  img.src = r.image || "";
  img.alt = r.title || "Recipe";

  // Show modal
  modal.removeAttribute("hidden");

  // Close modal when X clicked
  document.getElementById("closePreview").onclick = () => {
    modal.setAttribute("hidden", true);
  };
}


/* ===== plan & groceries ===== */

function addToPlan(recipe) {
  console.log("addToPlan called for:", recipe.id);
  if (!plan.has(recipe.id)) {
    plan.set(recipe.id, { recipe, count: 1 });
  } else {
    plan.get(recipe.id).count += 1;
  }
  renderPlan();
  renderGroceries();
}


function renderPlan() {
  els.mealPlan.innerHTML = "";

  for (const { recipe, count } of plan.values()) {
    const li = document.createElement("li");
    li.className = "item";

    const img = recipe.image || (recipe.imageUrls && recipe.imageUrls[0]) || "";

    li.innerHTML = `
      <img class="thumb" src="${img}" alt="" />
      <div class="item__name">${escapeHTML(recipe.title || recipe.name || "Recipe")} <span class="kv"><span class="dot"></span>x${count}</span></div>
      <div class="counter">
        <button aria-label="decrement">−</button>
        <div class="count">${count}</div>
        <button aria-label="increment">+</button>
        <button class="trash" aria-label="remove">✕</button>
      </div>
    `;

    const buttons = li.querySelectorAll(".counter button");
    const [decBtn, incBtn, trashBtn] = buttons;

    incBtn.addEventListener("click", () => {
      plan.get(recipe.id).count += 1;
      renderPlan();
      renderGroceries();
    });

    decBtn.addEventListener("click", () => {
      const entry = plan.get(recipe.id);
      if (!entry) { return; }
      entry.count -= 1;
      if (entry.count <= 0) { plan.delete(recipe.id); }
      renderPlan();
      renderGroceries();
    });

    trashBtn.addEventListener("click", () => {
      plan.delete(recipe.id);
      renderPlan();
      renderGroceries();
    });

    els.mealPlan.appendChild(li);
  }

  if (plan.size === 0) {
    els.mealPlan.innerHTML = `<li class="item" style="justify-content:center;">No recipes yet. Add from the left →</li>`;
  }
}

function renderGroceries(reset = false) {
  els.groceries.innerHTML = "";

  if (reset || plan.size === 0) {
    els.groceries.innerHTML = `<li class="item" style="justify-content:center;">No items</li>`;
    return;
  }

  const agg = consolidateIngredients();

  const names = Object.keys(agg).sort((a, b) => a.localeCompare(b));
  for (const name of names) {
    const row = agg[name];
    const li = document.createElement("li");
    li.className = "item";
    li.style.gridTemplateColumns = "1fr auto";
    const parts = [];

    if (row.g != null) { parts.push(prettyMass(row.g)); }
    if (row.ml != null) { parts.push(prettyVolume(row.ml)); }
    if (row.tsp != null) { parts.push(prettySpoons(row.tsp)); }
    if (row.count != null) { parts.push(`${fmt(row.count)} pcs`); }
    if (row.other && row.other.length) { parts.push(...row.other.map(x => `${fmt(x.amount)} ${x.unit}`)); }

    li.innerHTML = `
      <div class="item__name">${escapeHTML(name)}</div>
      <div class="kv">${parts.join("  •  ")}</div>
    `;
    els.groceries.appendChild(li);
  }
}

/* ===== consolidation ===== */

function consolidateIngredients() {
  const store = {}; // name -> { g, ml, tsp, count, other: [{amount, unit}] }

  for (const { recipe, count } of plan.values()) {
    const list = Array.isArray(recipe.extendedIngredients) ? recipe.extendedIngredients : [];
    if (list.length === 0) { continue; }

    for (const ing of list) {
      const baseName = (ing.nameClean || ing.name || "").toLowerCase().trim();
      if (!baseName) { continue; }

      const m = ing.measures && ing.measures.metric ? ing.measures.metric : {};
      let amount = num(m.amount);
      let unit = (m.unitShort || "").toLowerCase().trim();

      if (!store[baseName]) {
        store[baseName] = { g: null, ml: null, tsp: null, count: null, other: [] };
      }

      if (!isFinite(amount) || amount === 0) {
        // fallback: treat as 1 count if amount missing
        addCount(store[baseName], 1 * count);
        continue;
      }

      // multiply by how many times this recipe is in plan
      amount = amount * count;

      // normalize + route
      routeUnit(store[baseName], amount, unit);
    }
  }

  return store;
}

function routeUnit(bucket, amount, unit) {
  const u = unit.replace(/\./g, "");

  // mass
  if (u === "g" || u === "gram" || u === "grams") {
    bucket.g = add(bucket.g, amount); return;
  }
  if (u === "kg" || u === "kilogram" || u === "kilograms") {
    bucket.g = add(bucket.g, amount * 1000); return;
  }

  // volume (metric)
  if (u === "ml" || u === "milliliter" || u === "milliliters") {
    bucket.ml = add(bucket.ml, amount); return;
  }
  if (u === "l" || u === "lt" || u === "liter" || u === "liters") {
    bucket.ml = add(bucket.ml, amount * 1000); return;
  }

  // spoons/cups -> tsp base
  if (u === "tsp" || u === "tsps" || u === "teaspoon" || u === "teaspoons") {
    bucket.tsp = add(bucket.tsp, amount); return;
  }
  if (u === "tbsp" || u === "tbsps" || u === "tablespoon" || u === "tablespoons") {
    bucket.tsp = add(bucket.tsp, amount * 3); return; // 1 tbsp = 3 tsp
  }
  if (u === "cup" || u === "cups") {
    bucket.tsp = add(bucket.tsp, amount * 48); return; // 1 cup = 48 tsp
  }

  // counts / pieces
  if (u === "" || u === "piece" || u === "pieces" || u === "serving" || u === "servings") {
    addCount(bucket, amount); return;
  }

  // otherwise store as-is (keeps paprika 2 pinch, etc.)
  bucket.other.push({ amount, unit: unit || "unit" });
}

function add(current, addend) {
  if (current == null) { return addend; }
  return current + addend;
}

function addCount(bucket, n) {
  if (bucket.count == null) { bucket.count = n; } else { bucket.count += n; }
}

/* ===== helpers ===== */

function num(x) {
  const n = typeof x === "string" ? parseFloat(x) : x;
  if (!isFinite(n)) { return 0; }
  return n;
}

function fmt(n) {
  if (!isFinite(n)) { return "0"; }
  if (Math.abs(n) >= 100) { return Math.round(n).toString(); }
  if (Math.abs(n) >= 10) { return (Math.round(n * 10) / 10).toString(); }
  return (Math.round(n * 100) / 100).toString();
}

function prettyMass(g) {
  if (g >= 1000) { return `${fmt(g / 1000)} kg`; }
  return `${fmt(g)} g`;
}

function prettyVolume(ml) {
  if (ml >= 1000) { return `${fmt(ml / 1000)} L`; }
  return `${fmt(ml)} ml`;
}

function prettySpoons(tsp) {
  if (tsp >= 48) { return `${fmt(tsp / 48)} cup`; }
  if (tsp >= 3) { return `${fmt(tsp / 3)} tbsp`; }
  return `${fmt(tsp)} tsp`;
}

function escapeHTML(s) {
  return (s || "").replace(/[&<>"']/g, (c) => (
    { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]
  ));
}

function showLoading(flag) {
  els.loading.hidden = !flag;
}
function showError() {
  els.error.hidden = false;
}
function hideError() {
  els.error.hidden = true;
}
function setMeta(t) {
  els.resultsMeta.textContent = t;
}
