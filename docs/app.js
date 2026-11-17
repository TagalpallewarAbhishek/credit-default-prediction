const $ = (id) => document.getElementById(id);
const fmt = (value) => new Intl.NumberFormat('en-US').format(value);
const money = (value) => `$${fmt(value)}`;
const COLORS = ['#e9bc77', '#91b9e6', '#d98eac', '#96cfaa', '#c8b3ed', '#c7c9bb'];
let evidence;
let testPredictions;
let curveType = 'roc';
let isolatedModel = null;
let scenarioCosts = {fn: 10000, fp: 1500};

function color(index) { return COLORS[index % COLORS.length]; }
function coordinates(points, x, y) {
  return points.map(([a, b], index) => `${index ? 'L' : 'M'}${x(a).toFixed(2)},${y(b).toFixed(2)}`).join(' ');
}
function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] >= x) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}
function svgDot(cx, cy, radius, fill, label, extra = '') {
  return `<circle class="plot-dot ${extra}" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius}" fill="${fill}" stroke="#fffdf8" stroke-width="1.5" tabindex="0" role="img" aria-label="${label}"><title>${label}</title></circle>`;
}
function chartGrid(dark = false, bottom = 350) {
  const left = 55, right = 684, top = 24;
  const grid = [0, .25, .5, .75, 1].map((v) => {
    const x = left + v * (right - left), y = bottom - v * (bottom - top);
    const gridClass = dark ? 'curve-grid' : 'plot-grid';
    const labelClass = dark ? 'curve-label' : 'plot-label';
    return `<line class="${gridClass}" x1="${left}" x2="${right}" y1="${y}" y2="${y}"/><text class="${labelClass}" x="${left-8}" y="${y+4}" text-anchor="end">${Math.round(v*100)}%</text><text class="${labelClass}" x="${x}" y="${bottom+21}" text-anchor="middle">${Math.round(v*100)}%</text>`;
  }).join('');
  return grid;
}

function renderCurve() {
  if (!evidence) return;
  const budget = Number($('curve-budget').value) / 100;
  const left = 55, right = 684, top = 24, bottom = 350;
  const x = (v) => left + v * (right-left), y = (v) => bottom - v * (bottom-top);
  const label = curveType === 'roc' ? 'false-positive rate' : 'recall';
  const valueLabel = curveType === 'roc' ? 'recall' : 'precision';
  $('curve-budget-value').textContent = `${Math.round(budget*100)}%`;
  $('budget-label').textContent = curveType === 'roc' ? 'False-positive rate' : 'Recall';
  $('curve-description').textContent = curveType === 'roc'
    ? 'ROC curve: recall against false-positive rate, measured on validation.'
    : 'Precision–recall curve: precision at each recall level, measured on validation.';
  $('curve-note').textContent = curveType === 'roc'
    ? 'The ROC curves show validation ranking across thresholds. Slider readouts are approximate because curves are sampled for display. The majority dummy has only two operating points; intermediate false-positive rates are unavailable.'
    : 'The horizontal line shows the 22.1% validation default rate. Slider readouts are approximate because curves are sampled for display. The majority dummy has only two operating points; intermediate recall is unavailable.';
  const baseline = curveType === 'roc'
    ? `<path d="M${x(0)},${y(0)} L${x(1)},${y(1)}" stroke="#9bacb1" stroke-dasharray="5 6" fill="none"/>`
    : `<line x1="${left}" x2="${right}" y1="${y(evidence.defaults/evidence.rows)}" y2="${y(evidence.defaults/evidence.rows)}" stroke="#9bacb1" stroke-dasharray="5 6"/>`;
  const lines = evidence.models.map((model, index) => {
    const points = model[curveType];
    const dimmed = isolatedModel && isolatedModel !== model.name;
    if (model.name === 'Dummy (Majority)') {
      return points.map(([a,b]) => svgDot(x(a),y(b),5,color(index),`Dummy majority operating point: ${Math.round(a*100)}% ${label}, ${Math.round(b*100)}% ${valueLabel}`,dimmed ? 'dimmed' : '')).join('');
    }
    return `<path class="curve-path ${dimmed ? 'dimmed' : ''} ${isolatedModel === model.name ? 'highlighted' : ''}" d="${coordinates(points,x,y)}" stroke="${color(index)}"/>`;
  }).join('');
  const markers = evidence.models.map((model, index) => {
    if (model.name === 'Dummy (Majority)') return '';
    const value = interpolate(model[curveType], budget);
    const dimmed = isolatedModel && isolatedModel !== model.name;
    return svgDot(x(budget), y(value), 6, color(index), `${model.name}: approximately ${Math.round(value*100)}% ${valueLabel} at ${Math.round(budget*100)}% ${label}`, dimmed ? 'dimmed' : '');
  }).join('');
  $('curve-chart').classList.add('chart-dark');
  $('curve-chart').innerHTML = `<title>${curveType === 'roc' ? 'Validation ROC' : 'Validation precision–recall'} curves for six models</title>${chartGrid(true)}${baseline}<line x1="${x(budget)}" x2="${x(budget)}" y1="${top}" y2="${bottom}" stroke="#e8dcb7" stroke-dasharray="5 6"/>${lines}${markers}<text class="curve-label" x="370" y="404" text-anchor="middle">${curveType === 'roc' ? 'False-positive rate' : 'Recall'}</text><text class="curve-label" x="16" y="190" text-anchor="middle" transform="rotate(-90 16 190)">${curveType === 'roc' ? 'Recall' : 'Precision'}</text>`;
  $('curve-readouts').innerHTML = evidence.models.map((model, index) => {
    const unavailable = model.name === 'Dummy (Majority)' && budget > 0 && budget < 1;
    const value = interpolate(model[curveType], budget);
    const active = isolatedModel === model.name ? 'active' : '';
    return `<button type="button" class="curve-readout ${active}" data-model="${index}" style="--model-color:${color(index)}" aria-pressed="${active ? 'true' : 'false'}"><i aria-hidden="true"></i><span>${model.name}</span><strong>${unavailable ? '—' : `${Math.round(value*100)}%`}</strong></button>`;
  }).join('');
  document.querySelectorAll('[data-model]').forEach((button) => button.addEventListener('click', () => {
    const name = evidence.models[Number(button.dataset.model)].name;
    isolatedModel = isolatedModel === name ? null : name;
    renderCurve();
  }));
}

function renderMetric() {
  if (!evidence) return;
  const key = $('metric-select').value;
  const domain = key === 'pr_auc' ? [.2, .6] : key === 'roc_auc' ? [.45, .82] : [.12, .24];
  const x = (value) => 240 + (value-domain[0])/(domain[1]-domain[0])*390;
  const rows = evidence.models.map((model, index) => {
    const y = 51 + index*56, value = model[key];
    const printed = value.toFixed(4);
    return `<line class="metric-line" x1="240" y1="${y}" x2="630" y2="${y}"/><text class="plot-name" x="14" y="${y+4}">${model.name}</text><line x1="240" y1="${y}" x2="${x(value)}" y2="${y}" stroke="${color(index)}" stroke-width="3" opacity=".55"/>${svgDot(x(value),y,7,color(index),`${model.name}: ${printed} ${key.replace('_',' ')}`)}<text class="plot-number" x="${Math.min(x(value)+14,640)}" y="${y+4}">${printed}</text>`;
  }).join('');
  const ticks = Array.from({length:5},(_,i) => {
    const value = domain[0]+i*(domain[1]-domain[0])/4;
    return `<line class="plot-grid" x1="${x(value)}" x2="${x(value)}" y1="23" y2="340"/><text class="plot-label" x="${x(value)}" y="371" text-anchor="middle">${value.toFixed(2)}</text>`;
  }).join('');
  $('metric-chart').innerHTML = `<title>Validation ${key.replace('_',' ')} comparison</title>${ticks}${rows}`;
  $('metric-explanation').textContent = key === 'pr_auc'
    ? 'Random Forest has slightly higher validation PR-AUC than HistGradientBoosting. The final choice also considers assumed error cost.'
    : key === 'roc_auc'
      ? 'HistGradientBoosting has the highest validation ROC-AUC. ROC-AUC describes ranking over both classes; it does not determine a decision threshold.'
      : 'HistGradientBoosting has the lowest validation Brier score. Lower Brier means its probability estimates are closer to the observed outcomes on average.';
}

function renderLossBars() {
  if (!evidence) return;
  const largest = Math.max(...evidence.models.map((model) => model.loss_at_reference));
  $('loss-bars').innerHTML = evidence.models.map((model, index) => `<div class="loss-bar" tabindex="0" role="group" aria-label="${model.name}: ${money(model.loss_at_reference)} assumed validation loss; ${model.fn_at_reference} missed defaults and ${model.fp_at_reference} false alarms" title="${model.name}: ${money(model.loss_at_reference)} assumed loss · ${model.fn_at_reference} missed defaults · ${model.fp_at_reference} false alarms" style="--model-color:${color(index)}"><span class="loss-bar-label"><i aria-hidden="true"></i>${model.name}</span><div class="loss-track"><div class="loss-fill" style="width:${100*model.loss_at_reference/largest}%"></div></div><strong>${(model.loss_at_reference/1e6).toFixed(3)}m</strong></div>`).join('');
}

function renderThreshold() {
  if (!evidence) return;
  const model = evidence.models[Number($('threshold-model').value)];
  const requested = Number($('threshold-slider').value);
  const index = Math.round(requested*100)-1;
  const left = 55, right = 684, top = 24, bottom = 290;
  const losses = model.false_negatives.map((fn, i) => fn*scenarioCosts.fn + model.false_positives[i]*scenarioCosts.fp);
  const maxLoss = Math.max(1, ...losses)*1.05;
  const x = (v) => left + (v-.01)/.98*(right-left);
  const y = (v) => bottom - v/maxLoss*(bottom-top);
  const points = model.thresholds.map((threshold,i) => [threshold,losses[i]]);
  const current = losses[index];
  const ticks = [0, .25, .5, .75, 1].map((v) => `<line class="plot-grid" x1="${left}" x2="${right}" y1="${y(v*maxLoss)}" y2="${y(v*maxLoss)}"/><text class="plot-label" x="${left-8}" y="${y(v*maxLoss)+4}" text-anchor="end">${(v*maxLoss/1e6).toFixed(1)}m</text>`).join('');
  $('threshold-chart').innerHTML = `<title>Validation assumed loss by threshold for ${model.name}</title>${ticks}<path d="${coordinates(points,x,y)}" stroke="${color(Number($('threshold-model').value))}" stroke-width="3" fill="none" stroke-linejoin="round"/><line x1="${x(requested)}" x2="${x(requested)}" y1="${top}" y2="${bottom}" stroke="var(--accent)" stroke-dasharray="5 5"/>${svgDot(x(requested),y(current),7,color(Number($('threshold-model').value)),`${model.name} validation loss ${money(current)} at threshold ${requested.toFixed(2)}`)}<text class="plot-label" x="${left}" y="320">0.01</text><text class="plot-label" x="${right}" y="320" text-anchor="end">0.99</text><text class="plot-label" x="370" y="347" text-anchor="middle">Probability threshold</text>`;
  $('threshold-value').textContent = requested.toFixed(2);
  $('threshold-loss').textContent = money(current);
  $('threshold-fn').textContent = fmt(model.false_negatives[index]);
  $('threshold-fp').textContent = fmt(model.false_positives[index]);
  const bestIndex = losses.indexOf(Math.min(...losses));
  $('scenario-note').textContent = `With these assumed costs, ${model.name} has its lowest displayed validation loss at threshold ${model.thresholds[bestIndex].toFixed(2)}. This is an exploratory 0.01-step comparison, not a new final choice.`;
}

function updateScenarioCosts() {
  const missed = $('cost-missed');
  const alarm = $('cost-alarm');
  const valid = [missed, alarm].map((input) => {
    const value = input.valueAsNumber;
    const okay = Number.isInteger(value) && value >= 0 && value <= 10000000;
    input.setAttribute('aria-invalid', String(!okay));
    return okay;
  }).every(Boolean);
  $('cost-error').textContent = valid ? '' : 'Enter a whole dollar amount from 0 to 10,000,000 for each cost.';
  if (!valid) return;
  scenarioCosts = {fn: missed.valueAsNumber, fp: alarm.valueAsNumber};
  renderThreshold();
}

function renderTest() {
  if (!testPredictions) return;
  const threshold = Number($('test-slider').value);
  let fn = 0, fp = 0;
  for (let i = 0; i < testPredictions.y_true.length; i++) {
    const flag = testPredictions.y_prob[i] >= threshold;
    if (testPredictions.y_true[i] === 1 && !flag) fn++;
    if (testPredictions.y_true[i] === 0 && flag) fp++;
  }
  $('test-threshold').textContent = threshold.toFixed(3);
  $('test-fn').textContent = fmt(fn);
  $('test-fp').textContent = fmt(fp);
  $('test-loss').textContent = money(fn*testPredictions.cost_fn + fp*testPredictions.cost_fp);
}

function setupTheme() {
  const stored = localStorage.getItem('credit-default-preview-theme');
  document.documentElement.dataset.theme = stored === 'dark' || stored === 'light' ? stored : 'dark';
  const updateButton = () => { $('theme-toggle').textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('credit-default-preview-theme', next);
    updateButton();
  });
  updateButton();
}

function start() {
  setupTheme();
  try {
    evidence = window.creditPreviewData?.validation;
    testPredictions = window.creditPreviewData?.test;
    if (evidence.models.length !== 6 || evidence.rows !== 4500 || testPredictions.y_true.length !== 4500 || testPredictions.model !== 'HistGradientBoosting') throw new Error('Saved data do not match this six-model report');
    scenarioCosts = {fn: evidence.cost_fn, fp: evidence.cost_fp};
    $('cost-missed').value = scenarioCosts.fn;
    $('cost-alarm').value = scenarioCosts.fp;
    $('threshold-model').innerHTML = evidence.models.map((model,index) => `<option value="${index}">${model.name}</option>`).join('');
    $('test-slider').value = testPredictions.selected_threshold;
    renderCurve(); renderMetric(); renderLossBars(); renderThreshold(); renderTest();
  } catch (error) {
    $('curve-readouts').textContent = 'Chart data could not load. Rebuild assets/data.js with generate_chart_data.py.';
    $('threshold-loss').textContent = 'Data unavailable';
  }
}

document.querySelectorAll('[data-curve]').forEach((button) => button.addEventListener('click', () => {
  curveType = button.dataset.curve;
  document.querySelectorAll('[data-curve]').forEach((item) => { item.classList.toggle('active',item===button); item.setAttribute('aria-pressed',String(item===button)); });
  renderCurve();
}));
document.querySelectorAll('[data-budget]').forEach((button) => button.addEventListener('click', () => { $('curve-budget').value=button.dataset.budget; renderCurve(); }));
$('show-all').addEventListener('click', () => { isolatedModel=null; renderCurve(); });
$('curve-budget').addEventListener('input', renderCurve);
$('metric-select').addEventListener('change', renderMetric);
$('threshold-model').addEventListener('change', renderThreshold);
$('threshold-slider').addEventListener('input', renderThreshold);
$('cost-missed').addEventListener('input', updateScenarioCosts);
$('cost-alarm').addEventListener('input', updateScenarioCosts);
$('reset-costs').addEventListener('click', () => {
  $('cost-missed').value = evidence.cost_fn;
  $('cost-alarm').value = evidence.cost_fp;
  updateScenarioCosts();
});
$('test-slider').addEventListener('input', renderTest);
const observer = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { document.querySelectorAll('.side-index nav a').forEach((link) => link.classList.toggle('active',link.hash === `#${entry.target.id}`)); } }); }, {rootMargin:'-15% 0px -70% 0px'});
document.querySelectorAll('.section[id]').forEach((section) => observer.observe(section));
start();
