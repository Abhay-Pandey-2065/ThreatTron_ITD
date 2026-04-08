import os
import yaml
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import train_test_split
from utils.normalization import save_normalization_params

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Supervised Training...")
    if not config['pipeline']['train_models']:
        print("[!] train_models is false in config.yaml. Skipping training.")
        return
        
    in_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    if not os.path.exists(in_path):
        print("[-] Preprocessed data missing.")
        return
        
    df = pd.read_csv(in_path)
    
    if df.shape[0] < 10:
        print("[!] Not enough data to train. Exiting.")
        return
        
    features = [c for c in df.columns if c not in ['user_id', 'label']]
    os.makedirs(config['paths']['models_dir'], exist_ok=True)
    joblib.dump(features, os.path.join(config['paths']['models_dir'], 'feature_schema.pkl'))
    
    X = df[features]
    y = df['label']
    
    # Scale: Using RobustScaler instead of StandardScaler. 
    # RobustScaler uses Interquartile Range, completely ignoring intense insider outliers ensuring math stability.
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, os.path.join(config['paths']['models_dir'], 'scaler.pkl'))
    
    # Ensure stratify doesn't silently fail if sample size is extremely imbalanced
    try:
        if y.sum() >= 2:
            X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, stratify=y, random_state=42)
        else:
            X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    except Exception as e:
        print(f"[!] Stratification warning: {e}. Falling back to random splitting.")
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    
    # LightGBM (Is_unbalance=True for extreme needle-in-haystack scenarios)
    print("[+] Training LightGBM...")
    # class_weight='balanced' forces the tree to care immensely about the rare 1s
    lgb_model = lgb.LGBMClassifier(n_estimators=200, max_depth=8, class_weight='balanced', is_unbalance=True, n_jobs=-1, random_state=42, verbose=-1)
    lgb_model.fit(X_train, y_train)
    joblib.dump(lgb_model, os.path.join(config['paths']['models_dir'], 'v1_lightgbm.pkl'))
    lgb_preds = lgb_model.predict_proba(X_test)[:, 1] if len(set(y_train)) > 1 else [0] * len(X_test)
    save_normalization_params('lightgbm', lgb_preds, config['paths']['models_dir'])
    
    # Random Forest
    print("[+] Training Random Forest...")
    rf_model = RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced', n_jobs=-1, random_state=42)
    rf_model.fit(X_train, y_train)
    joblib.dump(rf_model, os.path.join(config['paths']['models_dir'], 'v1_rf.pkl'))
    rf_preds = rf_model.predict_proba(X_test)[:, 1] if len(set(y_train)) > 1 else [0] * len(X_test)
    save_normalization_params('random_forest', rf_preds, config['paths']['models_dir'])
    
    # Logistic Regression
    print("[+] Training Logistic Regression...")
    lr_model = LogisticRegression(max_iter=1000, class_weight='balanced', n_jobs=-1, random_state=42)
    lr_model.fit(X_train, y_train)
    joblib.dump(lr_model, os.path.join(config['paths']['models_dir'], 'v1_logistic.pkl'))
    lr_preds = lr_model.predict_proba(X_test)[:, 1] if len(set(y_train)) > 1 else [0] * len(X_test)
    save_normalization_params('logistic', lr_preds, config['paths']['models_dir'])

    print("[+] Supervised models trained and saved!")

if __name__ == '__main__':
    run()
