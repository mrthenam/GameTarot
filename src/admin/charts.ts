// Hand-rolled SVG/HTML charts for the dashboard: a daily column chart and horizontal bars.
// One series each (named by the card title), recessive grid, 4px rounded data-ends on the baseline,
// per-bar hover tooltip, and a table view for screen readers and anyone who prefers numbers.
import { esc, fmt, hideTip, showTip } from './ui';

export interface Column {
  label: string; // short axis label
  title: string; // tooltip heading
  value: number;
  rows: [string, string][]; // tooltip lines
}

/** Round tick step so the axis reads 0, 25, 50… or 0, 40, 80… */
function niceStep(max: number, ticks = 4) {
  const rough = Math.max(1, max / ticks);
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= rough && Number.isInteger(m * p)) return m * p;
  return 10 * p;
}

function topRounded(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Column chart that re-renders on resize. Returns a cleanup function. */
export function columnChart(host: HTMLElement, cols: Column[], ariaLabel: string, height = 260): () => void {
  host.classList.add('chart');
  const draw = () => {
    const W = Math.max(280, host.clientWidth);
    const H = height;
    const padL = 34, padR = 6, padT = 10, padB = 26;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const top = Math.max(0, ...cols.map((c) => c.value));
    const step = niceStep(top);
    const max = step * Math.max(1, Math.ceil(top / step));
    const band = plotW / cols.length;
    const bw = Math.max(6, Math.min(30, band * 0.58));
    const every = Math.max(1, Math.ceil(cols.length / Math.floor(plotW / 46)));
    const ticks: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
    let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(ariaLabel)}">`;
    s += '<g class="axis">';
    for (const t of ticks) {
      const y = padT + plotH - (t / max) * plotH;
      s += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"></line>`;
      s += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end">${fmt(t)}</text>`;
    }
    cols.forEach((c, i) => {
      if (i % every !== 0 && i !== cols.length - 1) return;
      const x = padL + band * i + band / 2;
      s += `<text x="${x}" y="${H - 6}" text-anchor="middle">${esc(c.label)}</text>`;
    });
    s += '</g><g>';
    cols.forEach((c, i) => {
      const x = padL + band * i + (band - bw) / 2;
      const h = (c.value / max) * plotH;
      s += `<rect class="hit" data-i="${i}" x="${padL + band * i}" y="${padT}" width="${band}" height="${plotH}"></rect>`;
      if (h > 0) s += `<path class="bar-mark" data-i="${i}" d="${topRounded(x, padT + plotH - h, bw, h)}"></path>`;
    });
    s += '</g></svg>';
    host.innerHTML = s;
    const svg = host.querySelector('svg')!;
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.min(cols.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) * (W / r.width) - padL) / band)));
      const c = cols[i];
      host.querySelectorAll('.bar-mark').forEach((b) => b.classList.toggle('hover', (b as SVGElement).dataset.i === String(i)));
      const h = (c.value / max) * plotH;
      const px = (padL + band * i + band / 2) * (r.width / W);
      const py = (padT + plotH - h) * (r.height / H);
      showTip(host, px, py, `<b>${esc(c.title)}</b>${c.rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}`);
    });
    svg.addEventListener('pointerleave', () => {
      hideTip(host);
      host.querySelectorAll('.bar-mark.hover').forEach((b) => b.classList.remove('hover'));
    });
  };
  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(host);
  return () => ro.disconnect();
}

/** Plain table of the same columns (the chart's table view). */
export function columnTable(cols: Column[], headers: string[]) {
  return `<div class="table-wrap"><table class="table">
    <thead><tr>${headers.map((h, i) => `<th class="${i ? 'right' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${cols.map((c) => `<tr><td>${esc(c.title)}</td>${c.rows.map(([, v]) => `<td class="right num">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/** Horizontal bars with direct labels: name, value and share. */
export function hbars(items: { name: string; dot?: string; value: number }[], unit: string) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="hbars">${items.map((i) => `
    <div class="hbar" title="${esc(i.name)}: ${fmt(i.value)} ${esc(unit)}">
      <div class="hbar-name">${i.dot ? `<span class="dot ${i.dot}"></span>` : ''}<span>${esc(i.name)}</span></div>
      <div class="hbar-val"><b>${fmt(i.value)}</b> · ${fmt((i.value / total) * 100, 1)}%</div>
      <div class="hbar-track"><i style="width:${(i.value / max) * 100}%"></i></div>
    </div>`).join('')}</div>`;
}
