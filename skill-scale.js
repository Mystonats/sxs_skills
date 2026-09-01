/* =========================================================
   SKILL SCALING — resolves assets/dex/skill-scaling-data.js

   One job: given a skill and a (rank, level, sub-rank), return
   the numbers the game itself would compute. Ported line for
   line from BattleFormulaHandler.CalcSkillProps:

     levelPropId = groupLevel[GroupLevelPropId][subRank]
     value = level[levelPropId][level][prop]
           x rank[RankPropId][rank][prop] / 10000
           x skill.f[prop]                / 10000

   Two behaviours worth keeping in mind while reading this:

   * A prop the skill has no factor for is DROPPED, not defaulted
     — the client's ScaleProps(removeUnscaled: true). So `f` is
     both the coefficient and the whitelist.
   * The level curve is flat for percentage props, so SkillAttack
     moves with RANK and the fixed values move with LEVEL. That is
     not a quirk of this file; it is the shape of the system.
   ========================================================= */
window.SXS_SKILL = (function () {
  const D = window.SXS_SKILL_SCALE;
  if (!D) return null;

  /* The source wiki reads these three strings from its site-wide i18n bundle.
     Here app.js supplies them, so this file stays a pure calculator. */
  function TXT() {
    return window.SXS_SKILL_TEXT ||
      { rankNone: "Unranked", quality: function (q) { return q; }, locale: "en" };
  }

  const PROP_IX = {};
  D.props.forEach((p, i) => { PROP_IX[p] = i; });

  /* How each prop reads to a human. `pct` values are stored x100, flat ones
     are already the number the game shows. Anything not listed falls back to
     flat, which is the safe way round: a raw number is honest, a wrongly
     scaled percentage is not. */
  const FORMAT = {
    SkillAttack1: "pct", SkillAttack2: "pct", SkillAttack3: "pct", SkillAttack4: "pct",
    SkillCureByHp: "pct", SkillCureByAttack: "pct",
    SkillCostByCurHp: "pct", SkillCostByMaxHp: "pct",
    SkillTargetReduceHpPer: "pct", SkillDmgUnitAddPer: "pct", SkillDmgMaxAddPer: "pct",
    SkillDmgAddPerByTargetHp: "pct", SkillDmgAddPerByLargeTarget: "pct",
    OnceHitHemophagiaPer: "pct",
    CD: "int", BreakResilience: "int",
  };

  /* Which props lead a card. Percentage damage first because that is the
     number people compare skills on; flat damage second. */
  const HEADLINE = ["SkillAttack1", "SkillFixedAttack1", "SkillCureByHp", "SkillFixedCure"];

  /* decoded curve columns, built on demand — the level tables run to 500
     entries and most sessions touch a handful of skills */
  const cache = new Map();

  function column(curveId, propIx) {
    const key = curveId + ":" + propIx;
    if (cache.has(key)) return cache.get(key);
    const enc = (D.curves[curveId] || {})[propIx];
    let out = null;
    if (enc) {
      /* [first, delta, runLength, delta, runLength, ...] */
      out = [enc[0]];
      for (let i = 1; i < enc.length; i += 2) {
        const d = enc[i], n = enc[i + 1];
        for (let k = 0; k < n; k++) out.push(out[out.length - 1] + d);
      }
    }
    cache.set(key, out);
    return out;
  }

  /* One curve's value at a level, clamped to the range it defines. A prop the
     curve omits falls back to level_prop_default_value, which is the client's
     own "everything else is 1.0" table; a prop that table does not cover
     either genuinely has no level curve, and the caller treats it as 1.0. */
  function curveAt(curveId, propIx, level) {
    const id = String(curveId);
    const lo = D.levelMin[id];
    if (lo === undefined) return null;
    const col = column(id, propIx);
    if (!col) {
      const covered = D.defaults[id] || [];
      return covered.indexOf(propIx) >= 0 ? (D.defaultValue[id] || 10000) : null;
    }
    return col[Math.max(0, Math.min(col.length - 1, level - lo))];
  }

  const skill = id => D.skills[String(id)] || null;
  const levelCurveId = (groupId, subRank) =>
    (D.groupLevel[String(groupId || 0)] || {})[subRank] || 0;

  /* The one calculation. `factors` and the curve ids differ between a skill's
     active and passive halves, so both go through here. */
  function propValue(factors, rankPropId, levelCurve, propIx, rank, level) {
    const f = factors[propIx];
    if (f === undefined) return null;                 /* removeUnscaled: true */
    let v = levelCurve ? curveAt(levelCurve, propIx, level) : null;
    if (v === null) v = 10000;
    if (rankPropId) {
      const rs = curveAt(rankPropId, propIx, rank);
      if (rs !== null) v = Math.trunc(v * rs / 10000);
    }
    return Math.trunc(v * f / 10000);
  }

  let VIEW_F = null;
  function extraFactors(id) {
    if (!VIEW_F) {
      VIEW_F = {};
      const list = (window.DEX_SKILLS && window.DEX_SKILLS.skills) || [];
      list.forEach(s => { if (s.viewF) VIEW_F[String(s.id)] = s.viewF; });
    }
    return VIEW_F[String(id)] || null;
  }

  function factorsOf(entry, which, id) {
    const src = which === "passive" ? (entry.pf || {}) : (entry.f || {});
    const out = {};
    for (const k in src) out[Number(k)] = src[k];
    if (which !== "passive" && id) {
      const extra = extraFactors(id);
      if (extra) {
        for (const name in extra) {
          const pix = PROP_IX[name];
          if (pix !== undefined && out[pix] === undefined) out[pix] = extra[name];
        }
      }
    }
    return out;
  }

  /* Everything a skill is worth at one point in the space. */
  function resolve(id, opts) {
    const e = skill(id);
    if (!e) return null;
    const o = opts || {};
    const rank = clampRank(o.rank);
    const sub = o.subRank || "Angel3";
    const level = o.level == null ? 1 : o.level;

    const out = { active: [], passive: [], statuses: e.st || [], elsewhere: !!e.elsewhere };

    const aF = factorsOf(e, "active", id);
    const aLevel = levelCurveId(e.g, sub);
    for (const pix in aF) {
      const v = propValue(aF, e.r, aLevel, Number(pix), rank, clampLevel(level, aLevel));
      if (v !== null) out.active.push({ prop: D.props[pix], ix: Number(pix), value: v });
    }

    const pF = factorsOf(e, "passive");
    const pLevel = levelCurveId(e.pg, sub);
    for (const pix in pF) {
      const v = propValue(pF, e.pr, pLevel, Number(pix), rank, clampLevel(level, pLevel));
      if (v !== null) out.passive.push({ prop: D.props[pix], ix: Number(pix), value: v });
    }
    /* passive factors naming a prop outside the 16 the curves carry: the
       factor is the whole story there, since no curve scales it */
    for (const name in (e.pfx || {})) {
      out.passive.push({ prop: name, ix: -1, value: e.pfx[name], flat: true });
    }

    const order = p => {
      const i = HEADLINE.indexOf(p.prop);
      return i < 0 ? HEADLINE.length : i;
    };
    out.active.sort((a, b) => order(a) - order(b) || a.prop.localeCompare(b.prop));
    out.passive.sort((a, b) => a.prop.localeCompare(b.prop));
    return out;
  }

  /* The value across every rank, at a fixed level — the damage curve. */
  function rankSeries(id, propName, opts) {
    const e = skill(id);
    if (!e) return null;
    const pix = PROP_IX[propName];
    const o = opts || {};
    const which = o.passive ? "passive" : "active";
    const f = factorsOf(e, which, id);
    if (f[pix] === undefined) return null;
    const curve = levelCurveId(which === "passive" ? e.pg : e.g, o.subRank || "Angel3");
    const lv = clampLevel(o.level == null ? 1 : o.level, curve);
    const rp = which === "passive" ? e.pr : e.r;
    const out = [];
    for (let r = 0; r < D.ranks.length; r++) out.push(propValue(f, rp, curve, pix, r, lv));
    return out;
  }

  /* The value across a level span, at a fixed rank. */
  function levelSeries(id, propName, opts) {
    const e = skill(id);
    if (!e) return null;
    const pix = PROP_IX[propName];
    const o = opts || {};
    const which = o.passive ? "passive" : "active";
    const f = factorsOf(e, which, id);
    if (f[pix] === undefined) return null;
    const curve = levelCurveId(which === "passive" ? e.pg : e.g, o.subRank || "Angel3");
    const rp = which === "passive" ? e.pr : e.r;
    const rank = clampRank(o.rank);
    const hi = maxLevel(id, o.subRank || "Angel3");
    const from = Math.max(1, o.from || 1), to = Math.min(hi, o.to || hi);
    const step = Math.max(1, Math.round((to - from) / 120));
    const out = [];
    for (let lv = from; lv <= to; lv += step) {
      out.push({ level: lv, value: propValue(f, rp, curve, pix, rank, lv) });
    }
    if (out.length && out[out.length - 1].level !== to) {
      out.push({ level: to, value: propValue(f, rp, curve, pix, rank, to) });
    }
    return out;
  }

  function maxLevel(id, subRank) {
    const e = skill(id);
    if (!e) return 1;
    const c = levelCurveId(e.g, subRank || "Angel3") || levelCurveId(e.pg, subRank || "Angel3");
    return c ? (D.levelMax[String(c)] || 1) : 1;
  }

  function clampLevel(level, curveId) {
    if (!curveId) return level;
    const id = String(curveId);
    const lo = D.levelMin[id], hi = D.levelMax[id];
    if (lo === undefined) return level;
    return Math.max(lo, Math.min(hi, level));
  }

  function clampRank(rank) {
    const r = rank == null ? D.ranks.length - 1 : rank;
    return Math.max(0, Math.min(D.ranks.length - 1, r));
  }

  /* "Rainbow +10" — the ladder the game prints, from skill_rank. */
  function rankLabel(rank) {
    const r = D.ranks[clampRank(rank)];
    if (!r || !r.q || r.q === "None") return TXT().rankNone;
    const q = TXT().quality(r.q);
    return r.add ? q + " +" + r.add : q;
  }

  const rankQuality = rank => (D.ranks[clampRank(rank)] || {}).q || "None";

  /* the number as the game would print it */
  function format(prop, value) {
    if (value === null || value === undefined) return "—";
    const kind = FORMAT[prop] || "flat";
    if (kind === "pct") {
      return (value / 100).toLocaleString(TXT().locale, { maximumFractionDigits: 1 }) + "%";
    }
    if (kind === "int") return value.toLocaleString(TXT().locale);
    return Math.round(value).toLocaleString(TXT().locale);
  }

  const isPct = prop => (FORMAT[prop] || "flat") === "pct";

  /* Which axis actually moves a prop for this skill — the answer to "should I
     rank this up or level it?". Measured rather than assumed, so a skill whose
     rank curve happens to be flat reports that honestly. */
  function movesWith(id, propName, opts) {
    const rs = rankSeries(id, propName, opts);
    const hi = maxLevel(id, (opts || {}).subRank);
    const ls = levelSeries(id, propName, Object.assign({}, opts, { from: 1, to: hi }));
    const span = a => {
      if (!a || !a.length) return 0;
      const vals = a.map(x => (typeof x === "object" ? x.value : x)).filter(v => v != null);
      if (!vals.length) return 0;
      const lo = Math.min.apply(null, vals), hiV = Math.max.apply(null, vals);
      return lo > 0 ? hiV / lo : (hiV > 0 ? Infinity : 0);
    };
    return { rank: span(rs), level: span(ls) };
  }

  /* Where a rank curve stops paying — the plateau. Returns the first rank whose
     value equals the maximum, or null if it never flattens. */
  function plateau(series) {
    if (!series || !series.length) return null;
    const vals = series.filter(v => v != null);
    if (!vals.length) return null;
    const top = Math.max.apply(null, vals);
    if (top === Math.min.apply(null, vals)) return 0;
    for (let i = 0; i < series.length; i++) {
      if (series[i] === top) return i < series.length - 1 ? i : null;
    }
    return null;
  }

  return {
    data: D, props: D.props, ranks: D.ranks, PROP_IX, HEADLINE,
    skill, resolve, rankSeries, levelSeries, maxLevel,
    rankLabel, rankQuality, clampRank, format, isPct, movesWith, plateau,
    subRanks: Object.keys(D.groupLevel["1"] || {}),
  };
})();
