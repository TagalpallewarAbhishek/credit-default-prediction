"""Tune Decision Tree and XGBoost on training folds; save validation predictions."""

import os
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from preprocessing import build_preprocessor


def main() -> None:
    train = pd.read_csv("data/train.csv")
    val = pd.read_csv("data/val.csv")
    x_train, y_train = train.drop(columns="TARGET"), train["TARGET"].to_numpy()
    x_val, y_val = val.drop(columns="TARGET"), val["TARGET"].to_numpy()

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    candidates = {
        "Decision Tree": (
            DecisionTreeClassifier(random_state=42),
            {"clf__max_depth": [4, 8], "clf__min_samples_leaf": [20, 100]},
        ),
        "XGBoost": (
            XGBClassifier(
                n_estimators=200,
                objective="binary:logistic",
                eval_metric="logloss",
                tree_method="hist",
                random_state=42,
                n_jobs=1,
            ),
            {"clf__max_depth": [3, 5], "clf__learning_rate": [0.05, 0.1]},
        ),
    }

    probabilities = {"y_val": y_val}
    metrics = []
    for name, (classifier, grid) in candidates.items():
        search = GridSearchCV(
            Pipeline([("prep", build_preprocessor()), ("clf", classifier)]),
            param_grid=grid,
            scoring="average_precision",
            cv=cv,
            n_jobs=1,
            refit=True,
        )
        print(f"Tuning {name} with five training folds...", flush=True)
        search.fit(x_train, y_train)
        prob = search.best_estimator_.predict_proba(x_val)[:, 1]
        probabilities[name] = prob
        metrics.append({
            "Model": name,
            "Best_Params": str(search.best_params_),
            "CV_PR_AUC": search.best_score_,
            "Val_PR_AUC": average_precision_score(y_val, prob),
            "Val_ROC_AUC": roc_auc_score(y_val, prob),
            "Val_Brier": brier_score_loss(y_val, prob),
        })
        print(f"{name}: CV PR-AUC {search.best_score_:.4f}; validation PR-AUC {metrics[-1]['Val_PR_AUC']:.4f}", flush=True)

    os.makedirs("results", exist_ok=True)
    np.savez_compressed("results/additional_val_probs.npz", **probabilities)
    pd.DataFrame(metrics).to_csv("results/additional_val_metrics.csv", index=False)
    print("Saved Decision Tree and XGBoost validation probabilities and metrics.")


if __name__ == "__main__":
    main()
