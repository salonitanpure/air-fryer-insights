/* Analysis helpers shared by the page and the tests. Mirrors the Python notebook (Step 4, Cell 6). */
(function (root) {
  const MIN_N = 30;
  const FAILURE = ['stopped working over time', 'part broke', 'dead on arrival'];

  // Small CSV parser that handles quoted fields, escaped quotes and line breaks inside reviews.
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', i = 0, quoted = false;
    while (i < text.length) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { quoted = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift();
    return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, k) => [h, r[k]])));
  }

  function prepare(sampleRows, statRows) {
    const lab = sampleRows.filter(r => r.primary && r.primary !== 'INVALID' && r.primary !== 'ERROR');
    const stats = {};
    statRows.forEach(s => {
      const reviews = +s.reviews, unhappy = +s.unhappy;
      stats[s.product_type] = { reviews, unhappy, rate: unhappy / reviews };
    });
    return { lab, stats };
  }

  function countBy(rows, key) {
    const m = {};
    rows.forEach(r => { m[r[key]] = (m[r[key]] || 0) + 1; });
    return m;
  }

  function usableTypes(lab, stats) {
    const n = countBy(lab, 'product_type');
    return Object.keys(stats).filter(t => (n[t] || 0) >= MIN_N);
  }

  function sharesWithin(lab, type) {
    const sub = lab.filter(r => r.product_type === type);
    const c = countBy(sub, 'primary'), out = {};
    Object.keys(c).forEach(k => { out[k] = c[k] / sub.length; });
    return { shares: out, n: sub.length };
  }

  // Share of unhappy reviews per theme, weighted to the real mix of product types, with a 95% margin.
  function weightedShares(lab, stats, mapTheme) {
    const rows = mapTheme ? lab.map(r => Object.assign({}, r, { primary: mapTheme(r.primary) })) : lab;
    const types = usableTypes(rows, stats);
    const total = types.reduce((s, t) => s + stats[t].unhappy, 0);
    const per = {};
    types.forEach(t => { per[t] = sharesWithin(rows, t); });
    const themes = new Set();
    types.forEach(t => Object.keys(per[t].shares).forEach(k => themes.add(k)));
    const out = [];
    themes.forEach(th => {
      let share = 0, v = 0;
      types.forEach(t => {
        const w = stats[t].unhappy / total, p = per[t].shares[th] || 0;
        share += w * p;
        v += w * w * p * (1 - p) / per[t].n;
      });
      out.push({ theme: th, share, margin: 1.96 * Math.sqrt(v) });
    });
    return out.sort((a, b) => b.share - a.share);
  }

  function groupShare(lab, stats, themes) {
    const r = weightedShares(lab, stats, t => (themes.includes(t) ? '__group__' : t)).find(x => x.theme === '__group__');
    return r || { share: 0, margin: 0 };
  }

  // Complaints per 100 reviews = (share of reviews that are 1-2 stars) x (theme share among them)
  function perHundred(lab, stats, type) {
    const { shares } = sharesWithin(lab, type), out = {};
    Object.keys(shares).forEach(k => { out[k] = shares[k] * stats[type].rate * 100; });
    return out;
  }

  const api = { MIN_N, FAILURE, parseCSV, prepare, countBy, usableTypes, weightedShares, groupShare, perHundred };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Insights = api;
})(this);
