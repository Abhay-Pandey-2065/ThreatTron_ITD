# Version 0.3 - ThreatTron (Hybrid & Ensemble Approach)

This is a complete, train-once machine learning pipeline targeted at extracting and detecting anomalous users inside the CERT r4.2 dataset on a moderately sized CPU machine (16GB RAM constraints). 

## 🧠 Approach

1. **Supervised Modeling:** LightGBM, Random Forest, and Logsitic Regression using structured features derived from memory-safe chunked dataset loads.
2. **Unsupervised Modeling:** Isolation Forest explicitly trained on expected "normal" users to detect stark deviations.
3. **Normalization Strategy:** Each internal model pushes a probability/confidence array between 0 and 1, min-max normalized based on the parameters generated uniquely by its training pass. 
4. **Hybrid Risk Score:** A configuration-driven ensemble final risk score applies default configurable weights.

## 📁 Pipeline Usage

Adjust variables strictly mapped in `config.yaml` before proceeding!

- **01_load_and_merge.py:** Aggregates and merges `r4.2` logs into simplified feature vectors
- **02_feature_engineering.py:** Adds combinatorial risk ratios (e.g., `email_ratio`)
- **03_preprocess.py:** Fills missing values explicitly and scrubs malformed rows
- **04_train.py:** Compiles the primary Tree+Logistic suite (requires `train_models: true`)
- **05_evaluate.py:** Scores classification metrics
- **09_anomaly_detection.py:** Generates Unsupervised boundaries
- **07_predict.py:** Generates the normalized prediction list across **all models combined** globally
- **06_explain.py:** Computes local feature explanations with TreeExplainer SHAP
- **08_validate_against_observables.py:** Extracts ground-truth comparisons against `answers/` logs dynamically detecting temporally sensitive behaviors.
