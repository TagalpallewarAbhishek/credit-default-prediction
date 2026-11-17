# Published website

This folder is the static GitHub Pages source for the **six-model `main` branch** and its selected HistGradientBoosting model. The earlier design remains in `docs/`. The XGBoost experiments discussed separately are absent from this branch and are not presented here.

From the repository root:

```powershell
python website-preview/generate_chart_data.py
```

Open `website-preview/index.html` directly in Chrome, or serve the folder with `python -m http.server 8000 --directory website-preview` and open <http://localhost:8000/>. The generator reads the saved **validation** probability files, leaderboard, and final-model test predictions. It writes `assets/data.js`, which works from both a `file://` page and a web server. The test slider is descriptive; test data did not choose the reported model or threshold.

All graphs are rendered in browser JavaScript from saved results. The colored graph markers expand smoothly on hover and keyboard focus. Select a curve, move the FPR/recall slider, switch metrics, and inspect validation threshold trade-offs. Readers can change the assumed missed-default and false-alarm costs in the validation threshold explorer; the curve and loss readout recalculate from saved validation error counts. This scenario control does not retrain models, change the reported study assumptions, or choose a new final threshold. The site also keeps the original repository, data source, reproduction, and AI-disclosure links.

GitHub Actions deploys this folder on pushes to `main`. The public URL is <https://tagalpallewarabhishek.github.io/credit-default-prediction/>.
