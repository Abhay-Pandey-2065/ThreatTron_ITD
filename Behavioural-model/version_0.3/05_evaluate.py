import os
import yaml
import joblib
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Evaluating Supervised Models...")
    in_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    if not os.path.exists(in_path):
        return
        
    df = pd.read_csv(in_path)
    
    models_dir = config['paths']['models_dir']
    try:
        features = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
        scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
        lgb_model = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    except FileNotFoundError:
        print("[-] Models missing. Run 04_train.py first.")
        return
        
    X = df[features]
    y = df['label']
    X_scaled = scaler.transform(X)
    
    preds = lgb_model.predict(X_scaled)
    # Handle single class case seamlessly
    if len(set(y)) > 1:
        preds_proba = lgb_model.predict_proba(X_scaled)[:, 1]
    else:
        preds_proba = [0.0] * len(y)
    
    print("\n--- LightGBM Classification Report ---")
    if len(set(y)) > 1:
        print(classification_report(y, preds))
        print(f"ROC AUC: {roc_auc_score(y, preds_proba):.4f}")
    else:
        print("Only 1 class found in labels; cannot generate robust metrics.")

if __name__ == '__main__':
    run()
