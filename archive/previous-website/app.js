const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
let records = null;
let studyThreshold = 0.135;

function counts(threshold) {
  const out = {tp:0,fp:0,tn:0,fn:0};
  for (let i=0;i<records.y_true.length;i++) {
    const positive = records.y_prob[i] >= threshold;
    if (records.y_true[i] === 1) out[positive ? 'tp' : 'fn']++;
    else out[positive ? 'fp' : 'tn']++;
  }
  return out;
}
function cost(c, fnCost, fpCost) { return c.fn * fnCost + c.fp * fpCost; }
function drawChart(threshold, fnCost, fpCost) {
  const svg = $('cost-chart');
  const points = [];
  for (let i=0;i<=100;i++) points.push(cost(counts(i/100),fnCost,fpCost));
  const ymax = Math.max(...points,1);
  const x = (i) => 42 + 640*i/100;
  const y = (v) => 202 - 175*v/ymax;
  const path = points.map((v,i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const markerX = x(threshold*100), markerY = y(cost(counts(threshold),fnCost,fpCost));
  svg.innerHTML = `<title>Assumed loss by threshold; selected threshold ${threshold.toFixed(3)}</title><line x1="42" y1="202" x2="682" y2="202" stroke="#91a7a7"/><line x1="42" y1="25" x2="42" y2="202" stroke="#91a7a7"/><path d="${path}" fill="none" stroke="#196b7a" stroke-width="3"/><line x1="${markerX}" y1="25" x2="${markerX}" y2="202" stroke="#c35636" stroke-dasharray="4 4"/><circle cx="${markerX}" cy="${markerY}" r="5" fill="#c35636"/><text x="42" y="225" font-size="13">0</text><text x="664" y="225" font-size="13">1.0</text><text x="46" y="20" font-size="13">${money(ymax)}</text><text x="300" y="236" font-size="13">Probability threshold</text>`;
}
function update() {
  if (!records) return;
  const threshold = Number($('threshold').value);
  const fnCost = Number($('fn-cost').value);
  const fpCost = Number($('fp-cost').value);
  if (!Number.isFinite(fnCost) || !Number.isFinite(fpCost) || fnCost < 0 || fpCost < 0) {
    $('sim-status').textContent = 'Enter costs of zero or more to update the simulator.';
    return;
  }
  $('sim-status').textContent = '';
  $('threshold-value').textContent = threshold.toFixed(3);
  const c = counts(threshold);
  for (const key of ['tp','fp','tn','fn']) $(key).textContent = c[key].toLocaleString();
  const selected = cost(c,fnCost,fpCost);
  const reference = cost(counts(0.5),fnCost,fpCost);
  $('total-loss').textContent = money(selected);
  $('savings').textContent = `${money(Math.abs(reference-selected))} ${selected <= reference ? 'less' : 'more'} than at 0.50`;
  $('rates').textContent = `Recall ${((c.tp/(c.tp+c.fn))*100).toFixed(1)}% · Precision ${c.tp+c.fp ? ((c.tp/(c.tp+c.fp))*100).toFixed(1) : '0.0'}%`;
  drawChart(threshold,fnCost,fpCost);
}
async function start() {
  try {
    const response = await fetch('assets/test_predictions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    records = await response.json();
    if (records.y_true.length !== records.y_prob.length || records.y_true.length !== 4500) throw new Error('Unexpected prediction data');
    studyThreshold = records.selected_threshold;
    $('threshold').value = studyThreshold;
    $('fn-cost').value = records.cost_fn;
    $('fp-cost').value = records.cost_fp;
    update();
  } catch (error) {
    $('sim-status').textContent = 'Could not load test predictions. Serve the docs folder through a local web server, or open the published site.';
  }
}
$('threshold').addEventListener('input',update);
$('fn-cost').addEventListener('input',update);
$('fp-cost').addEventListener('input',update);
$('reset').addEventListener('click',() => { if (!records) return; $('threshold').value=studyThreshold; $('fn-cost').value=records.cost_fn; $('fp-cost').value=records.cost_fp; update(); });
document.querySelectorAll('[data-fn-cost]').forEach((button) => button.addEventListener('click', () => {
  $('fn-cost').value = button.dataset.fnCost;
  $('fp-cost').value = button.dataset.fpCost;
  update();
}));
start();
