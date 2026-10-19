(() => {
  'use strict';
  if (window.__gfsInjected) return;
  window.__gfsInjected = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let running = false;
  let autoDone = false;
  let panel, valShip, subShip, valShipped, subShipped, statusEl, runBtn;

  /* ---------------- styles ---------------- */
  const style = document.createElement('style');
  style.textContent = `
    #gfs-panel { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000;
      width: 268px; background: #fff; border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,.18);
      font-family: -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;
      font-size: 13px; color: #222; user-select: none; overflow: hidden; }
    #gfs-panel .gfs-head { display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #ffd000; font-weight: 600; cursor: move; }
    #gfs-panel .gfs-min { cursor: pointer; font-size: 15px; line-height: 1; padding: 0 4px; }
    #gfs-panel.gfs-folded .gfs-body { display: none; }
    #gfs-panel.gfs-folded { width: 190px; }
    #gfs-panel .gfs-body { padding: 6px 12px 12px; }
    #gfs-panel .gfs-row { display: flex; justify-content: space-between; align-items: baseline;
      padding: 8px 0; border-bottom: 1px dashed #eee; }
    #gfs-panel .gfs-label { color: #666; white-space: nowrap; }
    #gfs-panel .gfs-right { text-align: right; }
    #gfs-panel .gfs-val { font-size: 16px; font-weight: 700; color: #d4380d; }
    #gfs-panel .gfs-sub { color: #999; font-size: 12px; margin-left: 4px; }
    #gfs-panel .gfs-foot { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    #gfs-panel #gfs-run { background: #ffd000; border: none; border-radius: 6px;
      padding: 6px 12px; font-weight: 600; cursor: pointer; font-size: 13px; }
    #gfs-panel #gfs-run:disabled { opacity: .55; cursor: default; }
    #gfs-panel #gfs-status { color: #888; font-size: 12px; flex: 1; }
  `;

  /* ---------------- panel ---------------- */
  function buildPanel() {
    (document.head || document.documentElement).appendChild(style);
    panel = document.createElement('div');
    panel.id = 'gfs-panel';
    panel.innerHTML = `
      <div class="gfs-head">
        <span>闲鱼订单金额统计</span>
        <span class="gfs-min" title="折叠/展开">—</span>
      </div>
      <div class="gfs-body">
        <div class="gfs-row">
          <span class="gfs-label">待发货</span>
          <span class="gfs-right"><span class="gfs-val" id="gfs-val-ship">--</span><span class="gfs-sub" id="gfs-sub-ship"></span></span>
        </div>
        <div class="gfs-row">
          <span class="gfs-label">已发货待到账</span>
          <span class="gfs-right"><span class="gfs-val" id="gfs-val-shipped">--</span><span class="gfs-sub" id="gfs-sub-shipped"></span></span>
        </div>
        <div class="gfs-foot">
          <button id="gfs-run">立即统计</button>
          <span id="gfs-status"></span>
        </div>
      </div>`;
    document.body.appendChild(panel);

    valShip = panel.querySelector('#gfs-val-ship');
    subShip = panel.querySelector('#gfs-sub-ship');
    valShipped = panel.querySelector('#gfs-val-shipped');
    subShipped = panel.querySelector('#gfs-sub-shipped');
    statusEl = panel.querySelector('#gfs-status');
    runBtn = panel.querySelector('#gfs-run');

    runBtn.addEventListener('click', () => runStats());
    panel.querySelector('.gfs-min').addEventListener('click', () => panel.classList.toggle('gfs-folded'));

    let drag = null;
    const head = panel.querySelector('.gfs-head');
    head.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('gfs-min')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - drag.dx));
      const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - drag.dy));
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      panel.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => { drag = null; });
  }

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  /* ---------------- page helpers ---------------- */
  const tabInput = (value) => document.querySelector(`input[value="${value}"]`);
  const checkedTab = () => document.querySelector('.ant-radio-button-input:checked')?.value || null;

  function firstOrderNo() {
    const tr = document.querySelector('tr.ant-table-row');
    if (!tr) return null;
    const m = (tr.innerText || '').match(/订单编号\s*(\d+)/);
    return m ? m[1] : null;
  }

  function priceColIdx() {
    const ths = [...document.querySelectorAll('thead th')];
    const i = ths.findIndex((th) => (th.innerText || '').includes('成交价'));
    return i >= 0 ? i : 4;
  }

  function collectPage() {
    const colIdx = priceColIdx();
    const trs = [...document.querySelectorAll('tr.ant-table-row')];
    const orders = [];
    let cur = null;
    for (const tr of trs) {
      const txt = tr.innerText || '';
      if (txt.includes('订单编号')) {
        const no = (txt.match(/订单编号\s*(\d+)/) || [])[1] || '';
        cur = { no, price: null };
        orders.push(cur);
        continue;
      }
      if (cur && cur.price === null) {
        const tds = tr.querySelectorAll('td');
        const cell = tds.length > colIdx ? tds[colIdx].innerText : '';
        const m = cell.replace(/,/g, '').match(/[¥￥]\s*([\d.]+)/);
        if (m) cur.price = parseFloat(m[1]);
      }
    }
    return orders;
  }

  async function waitForListChange(prevFirst, maxMs = 12000) {
    const t0 = Date.now();
    await sleep(250);
    for (;;) {
      const spin = !!document.querySelector('.ant-spin-spinning');
      const first = firstOrderNo();
      if (!spin && first !== prevFirst && Date.now() - t0 > 350) return;
      if (!spin && !first && Date.now() - t0 > 1200) return;
      if (Date.now() - t0 > maxMs) return;
      await sleep(120);
    }
  }

  async function gotoList(value) {
    if (checkedTab() === value) return;
    const prevFirst = firstOrderNo();
    const input = tabInput(value);
    if (!input) return;
    input.closest('label').click();
    await waitForListChange(prevFirst);
  }

  async function collectAllPages() {
    const all = [];
    for (let i = 0; i < 100; i++) {
      all.push(...collectPage());
      const nextLi = document.querySelector('.ant-pagination-next');
      if (!nextLi || nextLi.classList.contains('ant-pagination-disabled')) break;
      const prevFirst = firstOrderNo();
      const btn = nextLi.querySelector('button') || nextLi;
      btn.click();
      await waitForListChange(prevFirst);
    }
    return all;
  }

  function summarize(orders) {
    const seen = new Set();
    let count = 0, sum = 0, invalid = 0;
    for (const o of orders) {
      if (o.no && seen.has(o.no)) continue;
      if (o.no) seen.add(o.no);
      if (o.price == null) { invalid++; continue; }
      count++;
      sum += o.price;
    }
    return { count, sum: Math.round(sum * 100) / 100, invalid };
  }

  function renderRow(key, r) {
    const val = key === 'ship' ? valShip : valShipped;
    const sub = key === 'ship' ? subShip : subShipped;
    val.textContent = fmt(r.sum);
    sub.textContent = `（${r.count} 单${r.invalid ? '，' + r.invalid + ' 单金额未识别' : ''}）`;
  }

  /* ---------------- main ---------------- */
  async function runStats() {
    if (running) return;
    if (!tabInput('NOT_SHIP') || !tabInput('SHIPPED')) {
      setStatus('请先打开订单管理页');
      return;
    }
    running = true;
    runBtn.disabled = true;
    const prevTab = checkedTab() || 'ALL';
    try {
      setStatus('统计待发货…');
      await gotoList('NOT_SHIP');
      const ship = summarize(await collectAllPages());
      renderRow('ship', ship);

      setStatus('统计已发货…');
      await gotoList('SHIPPED');
      const shipped = summarize(await collectAllPages());
      renderRow('shipped', shipped);

      setStatus('完成 ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (e) {
      setStatus('出错: ' + (e && e.message ? e.message : e));
    } finally {
      if (checkedTab() !== prevTab) {
        const p = firstOrderNo();
        const input = tabInput(prevTab);
        if (input) { input.closest('label').click(); await waitForListChange(p); }
      }
      running = false;
      runBtn.disabled = false;
    }
  }

  /* ---------------- boot ---------------- */
  function checkAuto() {
    if (autoDone || running) return;
    if (tabInput('NOT_SHIP')) {
      autoDone = true;
      setTimeout(runStats, 1000);
    }
  }

  function boot() {
    if (!document.body) { setTimeout(boot, 300); return; }
    buildPanel();
    setInterval(checkAuto, 1500);
  }

  boot();
})();
