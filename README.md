# Cost-sensitive credit default prediction

ES 335 final project by Tagalpallewar Abhishek Prashant (24110364) and Siddhantkumar Vinay Thute (24110373).

**Project website:** https://siddhant171.github.io/credit-default-prediction/ (hosted from the team member's fork). The static site source is in [`docs/`](docs/).  
**Repository:** https://github.com/TagalpallewarAbhishek/credit-default-prediction

## Question and data

Can account and payment history predict next-month default, and which probability threshold minimizes loss under different error costs? One row is one client account. The target is next-month default payment, not whether a new loan should be approved.

The [UCI Default of Credit Card Clients dataset](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients) has 30,000 Taiwan accounts, 23 predictors, and one binary target. It contains credit limits, demographics, six months of repayment statuses, bills, and payments. Roughly 22.12% of rows are defaults.

## Setup and run

Use Python 3.11 or newer. Run commands from the repository root.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python src/01_inspect_data.py
python src/02_split_data.py
python src/train_baselines.py
python src/analyze_baselines.py
python src/calibrate_and_optimize.py
python src/train_ensembles.py
python src/cost_optimizer.py
python src/evaluate_all_models.py
python -m http.server 8000 --directory docs
```

Open `http://localhost:8000/`. `01_inspect_data.py` downloads the UCI `.xls` file and saves `data/raw_credit_default.csv`. If the URL is unavailable, download the file from UCI and save a CSV copy with that path and the original column names. The split script then exports `data/train.csv`, `data/val.csv`, and `data/test.csv`.

The fixed stratified split is 70/15/15 with `random_state=42`. The script drops `ID`, renames the target to `TARGET` and `PAY_0` to `PAY_1`, groups undocumented education and marriage codes, and retains negative bill balances. Learned scaling and encoding fit inside model pipelines on training folds only.

## Results and verification

`results/metrics_summary.csv` and `results/val_leaderboard.csv` compare the six models on validation; `results/model_loss_comparison.png` shows their loss at two thresholds. `results/ensemble_val_metrics.csv` records tuned hyperparameters, five-fold training CV PR-AUC, and validation scores. The matching `.npz` files retain validation probabilities. `results/test_metrics.json` records the one-time held-out test report. `results/test_predictions.json` holds true labels and probabilities for the interactive simulator; `docs/assets/test_predictions.json` is its website copy. Other figures are in `docs/assets/`.

The validation comparison uses $10,000 per false negative and $1,500 per false positive at the fixed theoretical threshold 0.1304.

| Model | Best tuning values | CV PR-AUC | Validation PR-AUC | Validation ROC-AUC | Validation loss at 0.1304 |
| --- | --- | ---: | ---: | ---: | ---: |
| HistGradientBoosting | leaf nodes 15, learning rate 0.05 | 0.5656 | 0.5526 | 0.7800 | $4,187,500 |
| Random Forest | depth 8, minimum leaf size 2 | 0.5633 | 0.5527 | 0.7771 | $4,235,500 |

The selected HistGradientBoosting model had validation PR-AUC 0.5526, ROC-AUC 0.7800, and loss $4,187,500 at the theoretical 0.1304 threshold. A validation sweep selected 0.135. On 4,500 test accounts, PR-AUC was 0.5596, ROC-AUC 0.7798, and Brier score 0.1348. At 0.135, 171 defaults were missed and 1,686 non-defaults were flagged. Test-sample assumed loss was $4,239,000 versus $6,677,000 at 0.50. These are scenario costs using $10,000 per missed default and $1,500 per false alarm, not observed savings.

## Team division & walkthrough

- **Tagalpallewar Abhishek Prashant (24110364):** Data audit and cleaning, fixed 70/15/15 stratified split (`src/01_inspect_data.py`, `src/02_split_data.py`), leak-free feature engineering pipeline (`src/preprocessing.py`), linear and kernel baselines (`src/train_baselines.py`), EDA/Lasso/error archetype analysis (`src/analyze_baselines.py`), probability calibration (`src/calibrate_and_optimize.py`), and end-to-end walkthrough notebook (`notebooks/01_end_to_end_walkthrough.ipynb`).
- **Siddhantkumar Vinay Thute (24110373):** Tree-based ensembles (`src/train_ensembles.py`), validation cost-curve threshold optimization and one-time holdout test evaluation (`src/cost_optimizer.py`), and static GitHub Pages report + interactive cost simulator (`docs/`).

## Publish with GitHub Actions

The workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) uploads `docs/` and deploys it on pushes to `main` that change the site. The repository owner must enable Pages once:

1. Open the original repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Deploy website to GitHub Pages → Run workflow**, select `main`, and run it.
4. Wait for the `deploy` job to finish. Open the URL shown in **Settings → Pages** in a private browser window.

The expected canonical URL is `https://tagalpallewarabhishek.github.io/credit-default-prediction/`. The owner needs admin or maintainer permission to change the Pages source. If the workflow is blocked, check **Settings → Actions → General** for Actions permissions and **Settings → Environments → github-pages** for deployment restrictions.

## Limitations

The data describe Taiwan accounts in 2005. The dataset does not include actual loss amounts, recovery, intervention outcomes, or current populations. The costs are assumptions. Sex and marital status raise fairness questions requiring separate checks before any operational use.

## AI-use disclosure

Google Gemini and OpenAI Codex/ChatGPT assisted with Python pipeline scaffolding, diagnostic plotting scripts, static website layout/styling, and the original halftone hero illustration in `docs/assets/hero-ledger.webp` (generated via built-in ImageGen; prompt saved in `docs/assets/hero-ledger.prompt.txt`). Both team members independently verified all mathematical derivations, split boundaries, saved metrics, and literature citations against the raw code and data.

The illustration was made with the built-in ImageGen tool. Its [exact prompt](docs/assets/hero-ledger.prompt.txt) is saved with the asset.

The website's visual direction was inspired by the [GoShuin — Every stamp, a memory](https://www.awwwards.com/inspiration/desktop-goshuin-every-stamp-a-memory) example. Its artwork and interface assets were not reused.

## Citations

- Yeh, I.-C. (2009). [Default of Credit Card Clients](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients). UCI Machine Learning Repository. DOI: [10.24432/C55S3H](https://doi.org/10.24432/C55S3H).
- Pedregosa, F. et al. (2011). [Scikit-learn: Machine Learning in Python](https://jmlr.org/papers/v12/pedregosa11a.html). *Journal of Machine Learning Research*, 12, 2825–2830.
