"""Export validation evidence for the static website preview.

Run from the repository root: python website-preview/generate_chart_data.py
The test split is deliberately excluded from model-comparison charts.
"""

import csv
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import precision_recall_curve, roc_curve


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "website-preview" / "assets" / "data.js"
COST_FN, COST_FP = 10_000, 1_500
THRESHOLDS = np.linspace(0.01, 0.99, 99)
MODELS = [
    ("HistGradientBoosting", "HistGradientBoosting", "ensemble_val_probs.npz"),
    ("Random Forest", "Random Forest", "ensemble_val_probs.npz"),
    ("Ridge LogReg (L2)", "Logistic Regression (Ridge L2)", "baseline_val_probs.npz"),
    ("RBF SVM (Isotonic)", "RBF SVM (Isotonic Calibrated)", "calibrated_val_probs.npz"),
    ("Lasso LogReg (L1)", "Logistic Regression (Lasso L1)", "baseline_val_probs.npz"),
    ("Dummy (Majority)", "Dummy (Majority)", "baseline_val_probs.npz"),
]


def thin(points, maximum=360):
    """Keep curve endpoints while limiting browser SVG path size."""
    if len(points) <= maximum:
        return points
    take = np.unique(np.linspace(0, len(points) - 1, maximum).astype(int))
    return [points[i] for i in take]


def main():
    with (ROOT / "results" / "val_leaderboard.csv").open(newline="", encoding="utf-8") as file:
        metrics = {row["Model"]: row for row in csv.DictReader(file)}
    loaded = {name: np.load(ROOT / "results" / name) for name in {item[2] for item in MODELS}}
    try:
        labels = loaded["baseline_val_probs.npz"]["y_val"]
        if any(not np.array_equal(labels, file["y_val"]) for file in loaded.values()):
            raise ValueError("Validation labels differ between saved probability files")
        output = {"source": "Saved validation probabilities and val_leaderboard.csv", "rows": len(labels),
                  "defaults": int(labels.sum()), "cost_fn": COST_FN, "cost_fp": COST_FP,
                  "reference_threshold": COST_FP / (COST_FN + COST_FP), "models": []}
        for name, key, filename in MODELS:
            probabilities = loaded[filename][key]
            if len(probabilities) != len(labels):
                raise ValueError(f"Wrong probability count for {name}")
            fpr, tpr, _ = roc_curve(labels, probabilities)
            precision, recall, _ = precision_recall_curve(labels, probabilities)
            roc_points = [[round(float(x), 6), round(float(y), 6)] for x, y in zip(fpr, tpr)]
            pr_points = [[round(float(x), 6), round(float(y), 6)] for x, y in zip(recall[::-1], precision[::-1])]
            losses, false_negatives, false_positives = [], [], []
            for threshold in THRESHOLDS:
                flagged = probabilities >= threshold
                fn = int(np.count_nonzero((labels == 1) & ~flagged))
                fp = int(np.count_nonzero((labels == 0) & flagged))
                losses.append(fn * COST_FN + fp * COST_FP)
                false_negatives.append(fn)
                false_positives.append(fp)
            row = metrics[name]
            output["models"].append({
                "name": name,
                "pr_auc": float(row["PR_AUC"]), "roc_auc": float(row["ROC_AUC"]),
                "brier": float(row["Brier"]),
                "loss_at_reference": int(row["Loss_at_0.13 ($)"]),
                "fn_at_reference": int(row["FN_at_0.13"]),
                "fp_at_reference": int(row["FP_at_0.13"]),
                "roc": thin(roc_points), "pr": thin(pr_points),
                "thresholds": [round(float(value), 2) for value in THRESHOLDS],
                "losses": losses, "false_negatives": false_negatives,
                "false_positives": false_positives,
            })
        test = json.loads((ROOT / "results" / "test_predictions.json").read_text(encoding="utf-8"))
        if test["model"] != "HistGradientBoosting" or len(test["y_true"]) != 4500:
            raise ValueError("Saved test predictions do not match the six-model report")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        payload = {"validation": output, "test": test}
        OUT.write_text("window.creditPreviewData = " + json.dumps(payload, separators=(",", ":")) + ";\n", encoding="utf-8")
        print(f"Saved {OUT.relative_to(ROOT)} from {len(labels):,} validation rows")
    finally:
        for file in loaded.values():
            file.close()


if __name__ == "__main__":
    main()
