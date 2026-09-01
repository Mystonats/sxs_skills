/* =========================================================
   Sword X Staff — Skill Wiki

   Groups skills by the CLASS that unlocks them, not by a
   bare tier number: `promo` names the profession (Paladin,
   Ravager, …) and professions[promo].rank is its rank, so
   the headings read the same as the in-game advancement
   tree. Tier 1 is shared, and belongs to Warrior or Mage.
   ========================================================= */
(function () {
  "use strict";

  var D = window.DEX_SKILLS;
  if (!D) { document.getElementById("results").textContent = "skills-data.js failed to load."; return; }

  /* ---------- language: the one and only stored value ---------- */

  /* One localStorage key for the whole site. It holds the language and the
     theme; nothing else is ever persisted. */
  var LS_KEY = "sxs.prefs";
  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; }
  catch (e) { prefs = {}; }

  var lang = (prefs.lang === "de" || prefs.lang === "en") ? prefs.lang
           : ((navigator.language || "").toLowerCase().indexOf("de") === 0 ? "de" : "en");

  /* index.html already stamped data-theme before first paint; trust it. */
  var theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  /* The rank, realm and level the numbers are read at. Kept in the same
     prefs object so two skills opened in a row are always compared at the
     same point. Realm (Champion, Master, …) picks the level curve: flat
     damage moves with it, percentage does not. */
  var S = window.SXS_SKILL;
  var REALMS = [];
  var build = { rank: 34, level: 200, sub: "Gold3" };
  if (prefs.build) {
    if (prefs.build.rank != null) build.rank = prefs.build.rank;
    if (prefs.build.level != null) build.level = prefs.build.level;
    if (prefs.build.sub) build.sub = prefs.build.sub;
  }

  function realmName(r) {
    var n = (S && S.data.realms || {})[r];
    if (!n) return r;
    return (lang === "de" && n[1]) ? n[1] : n[0];
  }
  function realmFamily(r) {
    return realmName(r).replace(/\s+[IVX]+$/, "");
  }

  function maxLevelCap() {
    if (!S) return 1;
    var hi = 1;
    D.skills.forEach(function (sk) { hi = Math.max(hi, S.maxLevel(sk.id, build.sub)); });
    return hi;
  }

  function clampBuild() {
    if (!S) return;
    build.rank = S.clampRank(build.rank);
    if (REALMS.length && REALMS.indexOf(build.sub) < 0) {
      build.sub = REALMS[REALMS.length - 1];
    }
    var hi = maxLevelCap();
    var n = Number(build.level);
    build.level = Math.max(1, Math.min(hi, isFinite(n) ? n : 1));
  }

  if (S) {
    REALMS = S.subRanks.filter(function (r) {
      return !/^(Norank|Blackiron|Bronze)/.test(r) && realmName(r) !== r;
    });
    clampBuild();
  }

  function savePrefs() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lang: lang, theme: theme,
        build: { rank: build.rank, level: build.level, sub: build.sub }
      }));
    } catch (e) { /* private mode — the session still works, it just won't stick */ }
  }

  /* One chip per distinct level curve, labelled with the realm family
     (Champion, not Champion I/II/III — those three share a curve). */
  function realmChips() {
    var map = (S && S.data.groupLevel && S.data.groupLevel["1"]) || {};
    var seen = {}, out = [];
    REALMS.forEach(function (r) {
      var cid = map[r];
      if (cid == null || seen[cid]) return;
      seen[cid] = true;
      out.push({ id: r, label: realmFamily(r) });
    });
    return out;
  }

  function realmChipActive() {
    var map = (S && S.data.groupLevel && S.data.groupLevel["1"]) || {};
    var want = map[build.sub];
    var chips = realmChips();
    for (var i = 0; i < chips.length; i++) {
      if (map[chips[i].id] === want) return chips[i].id;
    }
    return build.sub;
  }

  function setRealm(id) {
    build.sub = id;
    clampBuild();
    savePrefs();
    renderRealmChips();
    reopen();
  }

  function renderRealmChips() {
    var host = document.getElementById("f-realm");
    if (!host) return;
    host.innerHTML = "";
    var active = realmChipActive();
    realmChips().forEach(function (it) {
      var b = el("button", null, it.label);
      b.type = "button";
      b.setAttribute("aria-pressed", it.id === active ? "true" : "false");
      b.onclick = function () { setRealm(it.id); };
      host.appendChild(b);
    });
  }

  /* Skill text is bilingual in the data: pick a suffix, don't load a bundle. */
  function pick(o, field) {
    if (!o) return "";
    return (lang === "de" && o[field + "_de"]) ? o[field + "_de"] : (o[field] || "");
  }

  var UI = {
    en: {
      "brand.sub": "Skill Wiki",
      "page.h1": "Skill Wiki",
      "page.lede": "Every skill in the game, grouped by the class that unlocks it.",
      "how.1": "Pick a class on the tree",
      "how.2": "Find a skill by name or filter",
      "how.3": "Open it — rank, realm and level live on the sheet",
      "tree.h": "Class advancement",
      "tree.hint": "Pick a class to see its skills. Advanced classes also inherit their starting kit.",
      "filter.search": "Search name or effect…",
      "filter.kind": "Type", "filter.rarity": "Rarity", "filter.element": "Element",
      "filter.realm": "Realm",
      "filter.reset": "Clear filters",
      "theme.toggle": "Switch between light and dark",
      "lang.group": "Language",
      "empty": "No skill matches those filters.",
      "foot.fan": "Fan-made and unofficial. Not affiliated with the developers of Sword X Staff.",
      all: "All", rank: "Rank", active: "Technique", passive: "Charm",
      warriorTree: "Warrior advancement tree", mageTree: "Mage advancement tree",
      count: function (n) { return n === 1 ? "1 skill" : n + " skills"; },
      shared: "Starting kit", inherits: "shared with every {c} class",
      range: "Range & area", cast: "Cast time", hits: "Hits", keywords: "Keywords",
      element: "Element", hitsAt: "{n} — at {t}",
      skillLevel: "Skill level", rankNone: "Unranked",
      damage: "Damage", healing: "Healing",
      prevQuality: "Previous quality", nextQuality: "Next quality",
      atNote: "Numbers read at this rank and level.",
      noNumbers: "No scaling coefficients in the client for this skill.",
      summonNote: "A summon — its numbers live on the summoned monster.",
      legendBody: "Caster", legendSkill: "Targetable", legendHit: "Hit", legendRandom: "Random",
      close: "Close", sec: "s",
      classLabel: "Class",
      levelN: "Level {n}",
      viewingAll: "All classes. Pick one on the tree to narrow the list.",
      viewingClass: "{name} · Rank {rank}",
      viewingKit: " — includes the {c} starting kit",
      elWind: "Wind", elWater: "Water", elFire: "Fire", elLight: "Light", elDark: "Dark"
    },
    de: {
      "brand.sub": "Fähigkeiten-Wiki",
      "page.h1": "Fähigkeiten-Wiki",
      "page.lede": "Alle Fähigkeiten des Spiels, nach der freischaltenden Klasse gruppiert.",
      "how.1": "Wähle eine Klasse im Baum",
      "how.2": "Finde eine Fähigkeit per Name oder Filter",
      "how.3": "Öffne sie — Stufe, Reich und Level stehen auf dem Blatt",
      "tree.h": "Klassenaufstieg",
      "tree.hint": "Wähle eine Klasse, um ihre Fähigkeiten zu sehen. Fortgeschrittene Klassen erben zusätzlich ihre Grundausrüstung.",
      "filter.search": "Name oder Wirkung suchen…",
      "filter.kind": "Art", "filter.rarity": "Seltenheit", "filter.element": "Element",
      "filter.realm": "Reich",
      "filter.reset": "Filter zurücksetzen",
      "theme.toggle": "Zwischen hell und dunkel wechseln",
      "lang.group": "Sprache",
      "empty": "Keine Fähigkeit passt zu diesen Filtern.",
      "foot.fan": "Fan-Projekt, inoffiziell. Nicht mit den Entwicklern von Sword X Staff verbunden.",
      all: "Alle", rank: "Rang", active: "Technik", passive: "Charme",
      warriorTree: "Aufstiegsbaum Krieger", mageTree: "Aufstiegsbaum Magier",
      count: function (n) { return n === 1 ? "1 Fähigkeit" : n + " Fähigkeiten"; },
      shared: "Grundausrüstung", inherits: "für jede {c}-Klasse gleich",
      range: "Reichweite & Wirkungsbereich", cast: "Wirkzeit", hits: "Treffer",
      keywords: "Schlüsselwörter", element: "Element", hitsAt: "{n} — bei {t}",
      skillLevel: "Skill-Level", rankNone: "Ohne Stufe",
      damage: "Schaden", healing: "Heilung",
      prevQuality: "Vorherige Qualität", nextQuality: "Nächste Qualität",
      atNote: "Werte bei dieser Stufe und diesem Level.",
      noNumbers: "Für diesen Skill stehen keine Skalierungs-Koeffizienten im Client.",
      summonNote: "Eine Beschwörung — ihre Werte liegen beim beschworenen Monster.",
      legendBody: "Wirker", legendSkill: "Zielbar", legendHit: "Treffer", legendRandom: "Zufällig",
      close: "Schließen", sec: "s",
      classLabel: "Klasse",
      levelN: "Level {n}",
      viewingAll: "Alle Klassen. Wähle eine im Baum, um die Liste einzugrenzen.",
      viewingClass: "{name} · Rang {rank}",
      viewingKit: " — inkl. der {c}-Grundausrüstung",
      elWind: "Wind", elWater: "Wasser", elFire: "Feuer", elLight: "Licht", elDark: "Dunkel"
    }
  };
  function t(k) { return (UI[lang] && UI[lang][k]) || UI.en[k] || k; }

  var TAGS = {
    en: { Attack: "DMG", Cure: "Heal", Shield: "Shield", Buff: "Buff", Debuff: "Debuff",
          Prop: "Stats", Auxiliary: "Drag", Mobile: "Movement", Summon: "Summon",
          Repel: "Knockback", Counterstrike: "Counterattack", Friend: "Ally",
          FireGrid: "Burn", DisperseStatus: "Dispel", SuperArmor: "Invincibility",
          Element: "Counter", AbnormalDebuff: "Ailment",
          SingleHit: "Single-Hit DMG", MultipleHit: "Multi-Hit DMG" },
    de: { Attack: "SCHD", Cure: "Heilung", Shield: "Schild", Buff: "Buff", Debuff: "Debuff",
          Prop: "Werte", Auxiliary: "Ziehen", Mobile: "Bewegung", Summon: "Beschwörung",
          Repel: "Rückstoß", Counterstrike: "Konterangriff", Friend: "Gefährte",
          FireGrid: "Brennen", DisperseStatus: "Bann", SuperArmor: "Unverwundbarkeit",
          Element: "Konter", AbnormalDebuff: "Anomalie",
          SingleHit: "Einzeltreffer-SCHD", MultipleHit: "Mehrfachtreffer-SCHD" }
  };
  function tagLabel(tag) { return (TAGS[lang] && TAGS[lang][tag]) || TAGS.en[tag] || tag; }

  var QUALITY = {
    en: { Blue: "Rare", Purple: "Epic", Orange: "Legendary",
          Gold: "Mythic", Red: "Divine", Rainbow: "Immortal" },
    de: { Blue: "Selten", Purple: "Episch", Orange: "Legendär",
          Gold: "Mythisch", Red: "Göttlich", Rainbow: "Unsterblich" }
  };
  function qualityName(q) { return (QUALITY[lang] && QUALITY[lang][q]) || QUALITY.en[q] || q; }

  var PROPS = {
    en: { SkillAttack1: "Damage (% ATK)", SkillAttack2: "2nd hit (% ATK)",
          SkillAttack3: "3rd hit (% ATK)", SkillAttack4: "4th hit (% ATK)",
          SkillFixedAttack1: "Flat damage", SkillFixedAttack2: "Flat damage (2nd)",
          SkillFixedCure: "Flat healing", SkillCureByHp: "Healing (% max HP)",
          SkillCureByAttack: "Healing (% ATK)", CD: "Cooldown",
          BreakResilience: "Poise break", OnceHitHemophagiaPer: "Lifesteal per hit",
          SkillDmgUnitAddPer: "DMG per stack", SkillDmgMaxAddPer: "DMG bonus cap",
          SkillCostByCurHp: "Cost (% current HP)", SkillCostByMaxHp: "Cost (% max HP)",
          SkillDmgAddPerByTargetHp: "DMG by target HP",
          SkillDmgAddPerByLargeTarget: "DMG vs large targets",
          Attack: "ATK", Defence: "DEF", MaxHp: "HP", Speed: "SPD",
          CritRatePercent: "Crit Rate", CritPowerPercent: "Crit DMG",
          BlockPercent: "Block Rate", CureAddPercent: "Healing",
          ElementMaster: "Element Mastery", KongFuMaster: "Physical Mastery",
          EffectRate: "Effect Hit", EffectDodge: "Effect RES" },
    de: { SkillAttack1: "Schaden (% ANGR)", SkillAttack2: "2. Treffer (% ANGR)",
          SkillAttack3: "3. Treffer (% ANGR)", SkillAttack4: "4. Treffer (% ANGR)",
          SkillFixedAttack1: "Fester Schaden", SkillFixedAttack2: "Fester Schaden (2.)",
          SkillFixedCure: "Feste Heilung", SkillCureByHp: "Heilung (% max. LP)",
          SkillCureByAttack: "Heilung (% ANGR)", CD: "Abklingzeit",
          BreakResilience: "Haltungsbruch", OnceHitHemophagiaPer: "Lebensraub pro Treffer",
          SkillDmgUnitAddPer: "SCHD pro Stapel", SkillDmgMaxAddPer: "SCHD-Bonus-Obergrenze",
          SkillCostByCurHp: "Kosten (% aktuelle LP)", SkillCostByMaxHp: "Kosten (% max. LP)",
          SkillDmgAddPerByTargetHp: "SCHD nach Ziel-LP",
          SkillDmgAddPerByLargeTarget: "SCHD gegen große Ziele",
          Attack: "ANGR", Defence: "VTD", MaxHp: "LP", Speed: "GESCHW",
          CritRatePercent: "Krit-Rate", CritPowerPercent: "Krit-SCHD",
          BlockPercent: "Blockrate", CureAddPercent: "Heilung",
          ElementMaster: "Elementar-Meisterschaft", KongFuMaster: "Physische Meisterschaft",
          EffectRate: "Effekt-Treffer", EffectDodge: "Effekt-WDST" }
  };
  function propName(p) { return (PROPS[lang] && PROPS[lang][p]) || PROPS.en[p] || p; }

  /* skill-scale.js reads its three strings from here. */
  function syncScaleText() {
    window.SXS_SKILL_TEXT = {
      rankNone: t("rankNone"),
      quality: qualityName,
      locale: lang === "de" ? "de-DE" : "en-GB"
    };
  }
  syncScaleText();

  /* Real class names, in the reading language. */
  function className(p) {
    var rec = D.professions[p];
    return (lang === "de" && rec && rec.name_de) ? rec.name_de : p;
  }
  function classRank(p) {
    var rec = D.professions[p];
    return rec ? rec.rank : 0;
  }

  /* ---------- the advancement tree ---------- */

  var TREE = D.tree || { Warrior: ["Duelist", "Knight"], Mage: ["Sage", "Sorcerer"] };
  var BASES = Object.keys(TREE);

  /* The data lists the two lineages of a base class in an arbitrary order.
     The in-game Class screen runs Sorcerer, Sage, Duelist, Knight from left to
     right, so pin that; a lineage not named here keeps the data's order. */
  var ROW_ORDER = { Warrior: ["Duelist", "Knight"], Mage: ["Sorcerer", "Sage"] };
  BASES.forEach(function (b) {
    var want = ROW_ORDER[b];
    if (!want) return;
    TREE[b] = TREE[b].slice().sort(function (x, y) {
      var i = want.indexOf(x), j = want.indexOf(y);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
    });
  });

  /* Base -> its two lineages, each an ordered rank 2..7 chain. A lineage is
     identified by `cls`, which every skill above rank 1 carries. */
  var LINEAGES = {};
  BASES.forEach(function (b) {
    LINEAGES[b] = TREE[b].map(function (lineage) {
      var chain = Object.keys(D.professions).filter(function (p) {
        return D.skills.some(function (s) { return s.promo === p && s.cls === lineage; });
      });
      chain.sort(function (a, b2) { return classRank(a) - classRank(b2); });
      return { key: lineage, chain: chain };
    });
  });

  /* Which lineage a profession belongs to, and which base it descends from. */
  /* Which base a profession descends from — the rank-1 kit it inherits — and
     a canonical position, so groups of equal rank read in tree order. */
  var BASE_OF = {}, ORDER_IX = {}, LINEAGE_OF = {}, seq = 0;
  BASES.forEach(function (b) {
    ORDER_IX[b] = seq++;
    LINEAGES[b].forEach(function (l) {
      l.chain.forEach(function (p) {
        BASE_OF[p] = b; LINEAGE_OF[p] = l.key; ORDER_IX[p] = seq++;
      });
    });
  });
  function lineageOf(p) { return LINEAGE_OF[p]; }

  var MAX_RANK = D.skills.reduce(function (m, s) { return Math.max(m, s.tier); }, 1);

  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* ---------- state ---------- */

  var state = { cls: "all", q: "", kind: "", rarity: "", element: "" };

  var RARITIES = ["SSR", "SR", "R"];
  var ELEMENTS = ["Wind", "Water", "Fire", "Light", "Dark"];

  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* A class shows its own skills plus the rank-1 kit it inherits: picking
     Vindicator without the Warrior basics would be a half-truth. */
  function inClass(s) {
    if (state.cls === "all") return true;
    if (classRank(state.cls) === 1) return s.promo === state.cls;
    if (s.cls === "Shared") return s.promo === BASE_OF[state.cls];
    return s.promo === state.cls;
  }

  function matches(s) {
    if (!inClass(s)) return false;
    if (state.kind && s.kind !== state.kind) return false;
    if (state.rarity && s.rarity !== state.rarity) return false;
    if (state.element && s.element !== state.element) return false;
    if (state.q) {
      var q = state.q;
      if (norm(s.name).indexOf(q) < 0 && norm(s.name_de).indexOf(q) < 0 &&
          norm(pick(s, "desc")).indexOf(q) < 0) return false;
    }
    return true;
  }

  /* ---------- rendering ---------- */

  var host = document.getElementById("results");
  var countEl = document.getElementById("count");
  var emptyEl = document.getElementById("empty");
  var overlay = document.getElementById("overlay");
  var sheet = document.getElementById("sheet");

  /* The in-game Class screen stacks ranks upward: the base class sits at the
     bottom and branches into its two lineages, which climb to rank 7. Columns
     are lineages, rows are ranks, and the connectors are CSS borders drawn in
     the head-room each cell reserves. */
  function renderTree() {
    var allHost = document.getElementById("tree-all");
    allHost.innerHTML = "";
    var allBtn = el("button", "cls");
    allBtn.type = "button";
    allBtn.appendChild(el("b", null, t("all")));
    allBtn.appendChild(el("i", null, UI[lang].count(D.skills.length)));
    allBtn.setAttribute("aria-pressed", state.cls === "all");
    allBtn.onclick = function () { state.cls = "all"; render(); };
    allHost.appendChild(allBtn);

    var box = document.getElementById("tree");
    box.innerHTML = "";

    /* left to right, the order the game uses */
    var cols = [];
    BASES.slice().reverse().forEach(function (b) {
      LINEAGES[b].forEach(function (l) { cols.push({ base: b, lineage: l }); });
    });

    var fam = document.getElementById("tree-families");
    fam.innerHTML = "";
    BASES.slice().reverse().forEach(function (b) {
      fam.appendChild(el("span", null, className(b)));
    });
    var caps = document.getElementById("tree-caps");
    caps.innerHTML = "";
    cols.forEach(function (c) {
      caps.appendChild(el("span", null, className(c.lineage.key)));
    });

    var sel = state.cls;
    var selRank = D.professions[sel] ? classRank(sel) : 0;
    var selLineage = sel !== "all" && selRank > 1 ? lineageOf(sel) : null;
    var selBase = sel !== "all" ? (selRank === 1 ? sel : BASE_OF[sel]) : null;

    for (var rank = MAX_RANK; rank >= 2; rank--) {
      cols.forEach(function (c) {
        var p = c.lineage.chain.filter(function (x) { return classRank(x) === rank; })[0];
        var cell = el("div", "node" + (rank < MAX_RANK ? " up" : ""));
        /* the line above a card is lit when the class above is on the path */
        if (selLineage === c.lineage.key && rank < selRank) cell.className += " lit";
        if (p) {
          var btn = classBtn(p);
          if (selLineage === c.lineage.key && rank <= selRank) btn.className += " lit";
          cell.appendChild(btn);
        }
        box.appendChild(cell);
      });
    }

    BASES.slice().reverse().forEach(function (b) {
      var br = el("div", "branch");
      if (selBase === b && selRank > 1) br.className += " lit";
      box.appendChild(br);
    });

    BASES.slice().reverse().forEach(function (b) {
      var cell = el("div", "node base");
      var btn = classBtn(b);
      btn.className += " base-card";
      if (selBase === b) btn.className += " lit";
      cell.appendChild(btn);
      box.appendChild(cell);
    });
  }

  function classBtn(p) {
    var b = el("button", "cls");
    b.type = "button";
    b.appendChild(el("b", null, className(p)));
    b.appendChild(el("i", null, t("rank") + " " + classRank(p)));
    b.setAttribute("aria-pressed", state.cls === p);
    b.onclick = function () {
      state.cls = (state.cls === p ? "all" : p);
      render();
      if (state.cls !== "all") {
        document.querySelector(".toolbar").scrollIntoView({ block: "start" });
      }
    };
    return b;
  }

  function chips(hostId, items, key) {
    var box = document.getElementById(hostId);
    box.innerHTML = "";
    items.forEach(function (it) {
      var b = el("button", null, it.label);
      b.type = "button";
      b.setAttribute("aria-pressed", state[key] === it.id);
      b.onclick = function () { state[key] = (state[key] === it.id ? "" : it.id); render(); };
      box.appendChild(b);
    });
  }

  /* One group per profession, ordered by rank then by the tree. */
  function groups(rows) {
    var byPromo = {};
    rows.forEach(function (s) { (byPromo[s.promo] = byPromo[s.promo] || []).push(s); });
    return Object.keys(byPromo).sort(function (a, b) {
      return classRank(a) - classRank(b) || ORDER_IX[a] - ORDER_IX[b];
    }).map(function (p) { return { promo: p, rows: byPromo[p] }; });
  }

  function badge(cls, txt) { return el("span", "badge " + cls, txt); }

  function card(s) {
    var b = el("button", "card " + s.rarity);
    b.type = "button";
    if (s.img) {
      var img = new Image();
      img.src = s.img; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
      img.width = 42; img.height = 42;
      b.appendChild(img);
    }
    var body = el("div", "body");
    body.appendChild(el("span", "nm", pick(s, "name")));
    var snip = pick(s, "desc");
    if (snip) body.appendChild(el("span", "snip", snip));
    var meta = el("span", "sk-meta");
    meta.appendChild(badge(s.rarity, s.rarity));
    meta.appendChild(badge("", t(s.kind)));
    if (s.element) meta.appendChild(badge("el " + s.element, t("el" + s.element)));
    body.appendChild(meta);
    b.appendChild(body);
    b.onclick = function () { openSheet(s); };
    return b;
  }

  function render() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-t]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-t"));
    });
    document.querySelectorAll("[data-t-ph]").forEach(function (n) {
      n.placeholder = t(n.getAttribute("data-t-ph"));
    });
    document.querySelectorAll("[data-t-al]").forEach(function (n) {
      n.setAttribute("aria-label", t(n.getAttribute("data-t-al")));
    });
    document.querySelectorAll(".lang button").forEach(function (n) {
      n.setAttribute("aria-pressed", n.getAttribute("data-lang") === lang);
    });

    renderTree();
    chips("f-kind", [{ id: "active", label: t("active") }, { id: "passive", label: t("passive") }], "kind");
    chips("f-rarity", RARITIES.map(function (r) { return { id: r, label: r }; }), "rarity");
    chips("f-element", ELEMENTS.map(function (e) { return { id: e, label: t("el" + e) }; }), "element");
    renderRealmChips();

    var rows = D.skills.filter(matches);
    countEl.textContent = UI[lang].count(rows.length);
    document.getElementById("reset").hidden =
      !(state.q || state.kind || state.rarity || state.element || state.cls !== "all");

    var viewing = document.getElementById("viewing");
    viewing.textContent = "";
    if (state.cls === "all") {
      viewing.textContent = t("viewingAll");
    } else {
      viewing.appendChild(el("b", null, className(state.cls)));
      viewing.appendChild(document.createTextNode(" · " + t("rank") + " " + classRank(state.cls)));
      if (classRank(state.cls) > 1 && BASE_OF[state.cls]) {
        viewing.appendChild(document.createTextNode(
          t("viewingKit").replace("{c}", className(BASE_OF[state.cls]))));
      }
    }

    host.innerHTML = "";
    emptyEl.hidden = rows.length > 0;
    emptyEl.textContent = t("empty");

    groups(rows).forEach(function (g) {
      var head = el("div", "group-head");
      var h = el("h3", null, className(g.promo));
      head.appendChild(h);
      head.appendChild(el("span", "rank", t("rank") + " " + classRank(g.promo)));
      head.appendChild(el("span", "n", UI[lang].count(g.rows.length)));
      host.appendChild(head);

      var prof = D.professions[g.promo];
      if (prof) {
        var desc = pick(prof, "desc");
        if (classRank(g.promo) === 1) {
          desc = t("shared") + " — " + UI[lang].inherits.replace("{c}", className(g.promo));
        }
        if (desc) host.appendChild(el("p", "group-desc", desc));
      }

      var grid = el("div", "grid");
      g.rows.slice().sort(function (a, b) {
        return RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
               pick(a, "name").localeCompare(pick(b, "name"));
      }).forEach(function (s) { grid.appendChild(card(s)); });
      host.appendChild(grid);
    });
  }

  /* ---------- detail sheet ---------- */

  /* `area` is the client's own board: a d x d grid with a camera offset and
     an explicit type per cell. range/aoe is the older fallback. */
  function board(s) {
    if (s.area && s.area.t) {
      var a = s.area, dim = a.d || 7, ox = a.ox || 0, oy = a.oy || 0, at = {};
      Object.keys(a.t).forEach(function (k) {
        (a.t[k] || []).forEach(function (p) { at[p[0] + "," + p[1]] = k; });
      });
      var half = Math.floor(dim / 2), g = el("div", "board");
      g.style.setProperty("--dim", dim);
      for (var y = half + oy; y >= half - dim + oy + 1; y--) {
        for (var x = -half + ox; x <= dim - half + ox - 1; x++) {
          g.appendChild(el("div", "cell " + (at[x + "," + y] || "")));
        }
      }
      return g;
    }
    var range = s.range || [], aoe = (s.aoe && s.aoe.length > 1) ? s.aoe : [];
    if (!range.length && !aoe.length) return null;
    var h = 3;
    range.concat(aoe).forEach(function (p) { h = Math.max(h, Math.abs(p[0]), Math.abs(p[1])); });
    var rs = {}, as = {};
    range.forEach(function (p) { rs[p[0] + "," + p[1]] = 1; });
    aoe.forEach(function (p) { as[p[0] + "," + p[1]] = 1; });
    var g2 = el("div", "board");
    g2.style.setProperty("--dim", h * 2 + 1);
    for (var yy = h; yy >= -h; yy--) {
      for (var xx = -h; xx <= h; xx++) {
        var k = xx + "," + yy;
        g2.appendChild(el("div", "cell " +
          (xx === 0 && yy === 0 ? "body" : as[k] ? "hit" : rs[k] ? "skill" : "")));
      }
    }
    return g2;
  }

  var lastFocus = null;

  /* ---------- rank / level tuning ----------
     Ported from the source wiki: the rank ladder is a flat list of
     {quality, +N} steps, so the quality arrows jump between blocks and the
     stars pick the +N inside the current block. */

  function qualityCode() { return S ? S.rankQuality(build.rank) : "Rainbow"; }

  function qualityOrder() {
    var qs = [];
    (S.ranks || []).forEach(function (r) {
      if (r.q && r.q !== "None" && qs[qs.length - 1] !== r.q) qs.push(r.q);
    });
    return qs;
  }

  function qualityMaxAdd(q) {
    var max = 0;
    S.ranks.forEach(function (x) { if (x.q === q) max = Math.max(max, x.add); });
    return max;
  }

  function setRankQualityAdd(q, add) {
    var want = Math.max(0, Math.min(qualityMaxAdd(q), add));
    for (var i = 0; i < S.ranks.length; i++) {
      if (S.ranks[i].q === q && S.ranks[i].add === want) {
        build.rank = i; savePrefs(); reopen(); return;
      }
    }
  }

  function shiftQuality(dir) {
    var qs = qualityOrder(), i = qs.indexOf(qualityCode()), next = qs[i + dir];
    if (!next) return;
    setRankQualityAdd(next, (S.ranks[S.clampRank(build.rank)] || {}).add || 0);
  }

  var STAR = "M12 2.2l2.6 6.4 6.9.6-5.2 4.5 1.6 6.7L12 16.8 6.1 20.4l1.6-6.7L2.5 9.2l6.9-.6z";

  function starRow() {
    var r = S.ranks[S.clampRank(build.rank)];
    if (!r || !r.q || r.q === "None") return null;
    var max = qualityMaxAdd(r.q);
    if (max < 1) return null;
    var filled = Math.max(0, Math.min(max, r.add || 0));
    var row = el("div", "sk-stars");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", S.rankLabel(build.rank));
    for (var i = 0; i < max; i++) {
      (function (n) {
        var star = el("button", "sk-star" + (n <= filled ? " is-on" : " is-off"));
        star.type = "button";
        star.title = qualityName(r.q) + " +" + n;
        star.setAttribute("aria-label", star.title);
        star.setAttribute("aria-pressed", n <= filled ? "true" : "false");
        star.dataset.fk = "star" + n;
        star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"/></svg>';
        star.onclick = function () { setRankQualityAdd(r.q, n === filled ? n - 1 : n); };
        row.appendChild(star);
      })(i + 1);
    }
    return row;
  }

  function qualityNav() {
    var q = qualityCode(), qs = qualityOrder(), at = qs.indexOf(q);
    var wrap = el("div", "sk-tier");
    var prev = el("button", "sk-tier-btn", "\u2039");
    prev.type = "button"; prev.disabled = at <= 0;
    prev.setAttribute("aria-label", t("prevQuality"));
    prev.dataset.fk = "qprev";
    prev.onclick = function () { shiftQuality(-1); };
    var name = el("div", "sk-tier-name", (!q || q === "None") ? t("rankNone") : qualityName(q));
    var next = el("button", "sk-tier-btn", "\u203a");
    next.type = "button"; next.disabled = at < 0 || at >= qs.length - 1;
    next.setAttribute("aria-label", t("nextQuality"));
    next.dataset.fk = "qnext";
    next.onclick = function () { shiftQuality(1); };
    wrap.appendChild(prev); wrap.appendChild(name); wrap.appendChild(next);
    return wrap;
  }

  function tuneBar(sk) {
    var hi = S.maxLevel(sk.id, build.sub) || maxLevelCap();
    var box = el("div", "sk-tune");

    var lv = el("label", "sk-tune-level");
    lv.appendChild(el("span", null, t("skillLevel")));
    var input = el("input");
    input.type = "number"; input.min = "1"; input.max = String(hi);
    input.value = String(Math.min(build.level, hi));
    input.setAttribute("aria-label", t("skillLevel"));
    input.dataset.fk = "level";
    input.onchange = function () {
      var n = parseInt(input.value, 10);
      build.level = Math.max(1, Math.min(hi, isFinite(n) ? n : 1));
      savePrefs(); reopen();
    };
    lv.appendChild(input);
    box.appendChild(lv);

    var realmRow = el("div", "sk-realms");
    realmRow.setAttribute("role", "group");
    realmRow.setAttribute("aria-label", t("filter.realm"));
    var active = realmChipActive();
    realmChips().forEach(function (it) {
      var b = el("button", "sk-realm" + (it.id === active ? " is-on" : ""), it.label);
      b.type = "button";
      b.setAttribute("aria-pressed", it.id === active ? "true" : "false");
      b.dataset.fk = "realm" + it.id;
      b.onclick = function () { setRealm(it.id); };
      realmRow.appendChild(b);
    });
    box.appendChild(realmRow);

    var rank = el("div", "sk-tune-rank");
    rank.appendChild(qualityNav());
    var stars = starRow();
    if (stars) rank.appendChild(stars);
    box.appendChild(rank);
    return box;
  }

  function combo(res, pctProp, flatProp) {
    var pct = null, flat = null;
    res.active.forEach(function (e) {
      if (e.prop === pctProp) pct = e;
      if (e.prop === flatProp) flat = e;
    });
    if (!pct && !flat) return null;
    var a = pct ? S.format(pct.prop, pct.value) : "";
    var b = flat ? Math.round(flat.value).toLocaleString(window.SXS_SKILL_TEXT.locale) : "";
    return (a && b) ? a + " + " + b : (a || S.format(flat.prop, flat.value));
  }

  /* The numbers panel: what this skill is worth at the chosen rank and level. */
  function statsPanel(sk) {
    if (!S) return null;
    var box = el("div", "sk-stats");
    box.appendChild(tuneBar(sk));

    var res = S.resolve(sk.id, build);
    function add(k, v) {
      if (v == null || v === "") return;
      var r = el("div", "sk-stat");
      r.appendChild(el("span", null, k));
      r.appendChild(el("b", null, String(v)));
      box.appendChild(r);
    }

    if (res) {
      var cd = null;
      res.active.forEach(function (e) { if (e.prop === "CD") cd = e; });
      if (cd) add(propName("CD"), S.format(cd.prop, cd.value));
      var dmg = combo(res, "SkillAttack1", "SkillFixedAttack1");
      if (dmg) add(t("damage"), dmg);
      var heal = combo(res, "SkillCureByHp", "SkillFixedCure") ||
                 combo(res, "SkillCureByAttack", "SkillFixedCure");
      if (heal) add(t("healing"), heal);
      if (!cd && !dmg && !heal) {
        (res.active.length ? res.active : res.passive).slice(0, 4).forEach(function (e) {
          add(propName(e.prop), S.format(e.prop, e.value));
        });
      }
    }

    if (!box.querySelector(".sk-stat") && !box.querySelector(".sk-nonum")) {
      box.appendChild(el("p", "sk-nonum",
        sk.tag === "Summon" ? t("summonNote") : t("noNumbers")));
    }
    return box;
  }

  function kindIcon(kind) {
    var box = el("span", "sk-kind-ico");
    box.setAttribute("aria-hidden", "true");
    box.innerHTML = kind === "passive"
      ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M8.5 10.5h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M6 4.5h10.5A1.5 1.5 0 0 1 18 6v13.2H7.2A1.2 1.2 0 0 1 6 18V4.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 18.2A1.2 1.2 0 0 1 7.2 17H18" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.2 8.2h6.2M9.2 11.4h6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    return box;
  }

  /* Built to match the in-game skill panel: quality-coloured title bar
     (tracks the rank picker), dark hero band, then the light info body. */
  function openSheet(s, redraw) {
    if (!opened) lastFocus = document.activeElement;
    opened = s;
    var q = qualityCode();
    sheet.className = "sheet sk-q-" + (q || "None");
    sheet.innerHTML = "";

    var head = el("header", "sk-head");
    head.appendChild(kindIcon(s.kind));
    var title = el("div", "sk-title", pick(s, "name"));
    title.id = "sheet-name";
    head.appendChild(title);
    var spark = el("span", "sk-spark", "\u2726");
    spark.setAttribute("aria-hidden", "true");
    head.appendChild(spark);
    var x = el("button", "close", "\u2715");
    x.type = "button";
    x.setAttribute("aria-label", t("close"));
    x.onclick = closeSheet;
    head.appendChild(x);
    sheet.appendChild(head);

    var hero = el("div", "sk-hero");
    var col = el("div", "sk-meta-col");
    col.appendChild(el("div", "sk-kind", t(s.kind)));
    col.appendChild(el("div", "sk-quality",
      (!q || q === "None") ? t("rankNone") : qualityName(q)));
    if (s.tag) col.appendChild(el("span", "sk-tag " + s.tag, tagLabel(s.tag)));
    hero.appendChild(col);
    var art = el("div", "sk-art");
    if (s.img) {
      var im = new Image();
      im.src = s.img; im.alt = ""; im.width = 108; im.height = 108;
      art.appendChild(im);
    }
    hero.appendChild(art);
    hero.appendChild(el("div", "sk-level-cap",
      t("levelN").replace("{n}", String(build.level))));
    sheet.appendChild(hero);

    var info = el("div", "sk-info");

    var row = el("div", "sk-row");
    var b = board(s);
    if (b) row.appendChild(b);
    var stats = statsPanel(s);
    if (stats) row.appendChild(stats);
    if (row.childNodes.length) info.appendChild(row);

    /* desc_html is pre-escaped by the generator; only .sk-c spans are markup */
    var d = el("p", "sk-desc");
    d.innerHTML = pick(s, "desc_html") || escapeText(pick(s, "desc"));
    info.appendChild(d);

    var kv = el("dl", "sk-kv");
    kv.appendChild(el("dt", null, t("classLabel")));
    kv.appendChild(el("dd", null, className(s.promo) + " · " + t("rank") + " " + classRank(s.promo)));
    if (s.element) {
      kv.appendChild(el("dt", null, t("element")));
      var dd = el("dd");
      dd.appendChild(el("span", "el " + s.element, t("el" + s.element)));
      kv.appendChild(dd);
    }
    if (s.hits) {
      kv.appendChild(el("dt", null, t("hits")));
      kv.appendChild(el("dd", null, (s.hits > 1 && s.delays && s.delays.length)
        ? t("hitsAt").replace("{n}", s.hits).replace("{t}", s.delays.join("s / ") + "s")
        : String(s.hits)));
    }
    if (s.cast) {
      kv.appendChild(el("dt", null, t("cast")));
      kv.appendChild(el("dd", null, s.cast + t("sec")));
    }
    info.appendChild(kv);

    if (s.links && s.links.length) {
      var kw = el("div", "kw");
      kw.appendChild(el("h4", null, t("keywords")));
      var dl = el("dl");
      s.links.forEach(function (l) {
        dl.appendChild(el("dt", null, pick(l, "name")));
        var ddk = el("dd");
        ddk.innerHTML = pick(l, "desc_html") || escapeText(pick(l, "desc"));
        dl.appendChild(ddk);
      });
      kw.appendChild(dl);
      info.appendChild(kw);
    }

    sheet.appendChild(info);

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (!redraw) x.focus();
  }

  /* Redraw the open sheet in place after a rank/level change, putting focus
     back on the control that caused it rather than snapping to Close. */
  var opened = null;
  function reopen() {
    if (!opened) return;
    var act = document.activeElement;
    var key = act && act.dataset ? act.dataset.fk : null;
    openSheet(opened, true);
    if (!key) return;
    var back = sheet.querySelector('[data-fk="' + key + '"]');
    if (back && !back.disabled) back.focus();
    else { var c = sheet.querySelector(".close"); if (c) c.focus(); }
  }

  function escapeText(s) {
    var n = document.createElement("div");
    n.textContent = s || "";
    return n.innerHTML;
  }

  function closeSheet() {
    opened = null;
    overlay.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- wiring ---------- */

  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSheet(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeSheet();
  });

  var qEl = document.getElementById("q");
  qEl.addEventListener("input", function () { state.q = norm(qEl.value.trim()); render(); });

  document.getElementById("reset").onclick = function () {
    state = { cls: "all", q: "", kind: "", rarity: "", element: "" };
    qEl.value = "";
    render();
  };

  document.querySelectorAll(".lang button").forEach(function (b) {
    b.onclick = function () {
      lang = b.getAttribute("data-lang");
      syncScaleText();
      savePrefs();
      render();
      reopen();
    };
  });

  document.getElementById("theme").onclick = function () {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    savePrefs();
  };

  render();
})();
