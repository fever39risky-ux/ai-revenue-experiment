(() => {
  const isRoot = /\/ai-revenue-experiment\/?(?:index\.html)?$/.test(location.pathname) || location.pathname === '/';
  if (!isRoot) return;

  const fmtYen = n => '¥' + Number(n || 0).toLocaleString('en-US');
  const fmtUsd = n => '$' + Number(n || 0).toFixed(2);
  const lang = () => window.AIRevenueI18n?.get?.() || 'ja';

  async function read(path, fallback = {}) {
    try {
      const r = await fetch(path + '?ts=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return fallback;
      return await r.json();
    } catch { return fallback; }
  }

  function style() {
    if (document.getElementById('observer-style')) return;
    const s = document.createElement('style');
    s.id = 'observer-style';
    s.textContent = `
      .observer-grid{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
      .observer-cell{padding:22px 22px 24px 0;border-right:1px solid var(--line);margin-right:22px;min-width:0}
      .observer-cell:last-child{border-right:0;margin-right:0}
      .observer-k{font:10px var(--mono);letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
      .observer-v{font-size:24px;font-weight:650;letter-spacing:-.035em;margin-top:6px;word-break:break-word}
      .observer-v.mint{color:var(--mint)}
      .observer-note{color:var(--muted);font-size:13px;max-width:760px;margin:18px 0 0}
      .observer-gate{margin-top:24px;border-left:2px solid var(--cyan);padding:2px 0 2px 16px;font:12px var(--mono);color:var(--muted)}
      .observer-gate b{color:var(--ink);font-weight:500}
      @media(max-width:760px){.observer-grid{grid-template-columns:1fr 1fr}.observer-cell{margin-right:0;padding-right:14px}.observer-cell:nth-child(2){border-right:0}.observer-cell:nth-child(3),.observer-cell:nth-child(4){border-top:1px solid var(--line)}}
    `;
    document.head.appendChild(s);
  }

  function mount() {
    const sections = [...document.querySelectorAll('.section')];
    const protocol = sections.find(s => s.textContent.includes('PROTOCOL'));
    if (!protocol || document.getElementById('ai-economics')) return null;
    const section = document.createElement('section');
    section.className = 'section';
    section.id = 'ai-economics';
    section.innerHTML = `
      <div class="section-id">02.5 / ECONOMICS</div>
      <div>
        <h2 id="observer-title">AIは、自分を起こすコストも管理する。</h2>
        <div class="observer-grid">
          <div class="observer-cell"><div class="observer-k" id="obs-k1">現在の起動頻度</div><div class="observer-v" id="obs-cadence">—</div></div>
          <div class="observer-cell"><div class="observer-k" id="obs-k2">次回定時判断</div><div class="observer-v" id="obs-time">—</div></div>
          <div class="observer-cell"><div class="observer-k" id="obs-k3">直近実測AIコスト</div><div class="observer-v" id="obs-lastcost">—</div></div>
          <div class="observer-cell"><div class="observer-k" id="obs-k4">公式期間コスト</div><div class="observer-v mint" id="obs-officialcost">¥0</div></div>
        </div>
        <p class="observer-note" id="observer-note"></p>
        <div class="observer-gate" id="observer-gate"></div>
      </div>`;
    protocol.insertAdjacentElement('afterend', section);
    return section;
  }

  async function render() {
    style();
    if (!mount()) return;
    const [cadence, costs] = await Promise.all([
      read('./status/cadence.json'),
      read('./status/cost_ledger.json')
    ]);
    const prep = costs.preparation_entries || [];
    const latestAi = [...prep, ...(costs.official_entries || [])].filter(e => e.category === 'ai_compute').at(-1);
    document.getElementById('obs-cadence').textContent = cadence.current_cadence || '—';
    document.getElementById('obs-time').textContent = cadence.current_time_jst ? cadence.current_time_jst + ' JST' : '—';
    document.getElementById('obs-lastcost').textContent = latestAi ? `${latestAi.currency === 'usd' ? fmtUsd(latestAi.amount) : latestAi.amount + ' ' + String(latestAi.currency || '').toUpperCase()} / ${fmtYen(latestAi.jpy_equivalent)}` : '—';
    document.getElementById('obs-officialcost').textContent = fmtYen(costs.totals?.official_cost_jpy_equivalent || 0);

    const apply = () => {
      const ja = lang() === 'ja';
      document.getElementById('observer-title').textContent = ja ? 'AIは、自分を起こすコストも管理する。' : 'The AI also manages the cost of waking itself.';
      document.getElementById('obs-k1').textContent = ja ? '現在の起動頻度' : 'Current cadence';
      document.getElementById('obs-k2').textContent = ja ? '次回定時判断' : 'Scheduled judgment';
      document.getElementById('obs-k3').textContent = ja ? '直近実測AIコスト' : 'Latest measured AI cost';
      document.getElementById('obs-k4').textContent = ja ? '公式期間コスト' : 'Official-period cost';
      document.getElementById('observer-note').textContent = ja
        ? `起動頻度は固定条件ではありません。売上・市場変化・戦略変更頻度・1回あたりのAIコストを見ながら、Claude Code自身が再評価します。準備期間コスト: ${fmtYen(costs.totals?.preparation_cost_jpy_equivalent || 0)}。`
        : `Cadence is not fixed. Claude Code re-evaluates it from revenue, market change, strategy-change frequency, and measured AI cost per run. Preparation-period cost: ${fmtYen(costs.totals?.preparation_cost_jpy_equivalent || 0)}.`;
      const gate = cadence.off_cycle_run_gate || 'expected marginal benefit > marginal AI cost';
      document.getElementById('observer-gate').innerHTML = ja
        ? `追加起動ゲート / <b>期待される追加便益 &gt; 追加AIコスト</b>`
        : `OFF-CYCLE GATE / <b>${gate.replace(/>/g,'&gt;')}</b>`;
    };
    apply();
    window.addEventListener('airevenue:language', apply);
  }

  document.addEventListener('DOMContentLoaded', render);
})();
