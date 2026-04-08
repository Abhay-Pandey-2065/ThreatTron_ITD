import os
import yaml
import joblib
import pandas as pd
from utils.normalization import min_max_normalize_array, load_normalization_params

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Prediction Pipeline...")
    in_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    df = pd.read_csv(in_path)
    
    models_dir = config['paths']['models_dir']
    
    print("[+] Loading models...")
    features = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
    scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
    
    lgb_model = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    rf_model = joblib.load(os.path.join(models_dir, 'v1_rf.pkl'))
    lr_model = joblib.load(os.path.join(models_dir, 'v1_logistic.pkl'))
    iso_model = joblib.load(os.path.join(models_dir, 'v1_isolation.pkl'))
    
    X = df[features]
    X_scaled = scaler.transform(X)
    
    print("[+] Generating raw scores...")
    raw_lgb = lgb_model.predict_proba(X_scaled)[:, 1] if lgb_model.classes_.shape[0] > 1 else [0.0]*len(X)
    raw_rf = rf_model.predict_proba(X_scaled)[:, 1] if rf_model.classes_.shape[0] > 1 else [0.0]*len(X)
    raw_lr = lr_model.predict_proba(X_scaled)[:, 1] if lr_model.classes_.shape[0] > 1 else [0.0]*len(X)
    raw_anomaly = -iso_model.score_samples(X_scaled) 
    
    print("[+] Normalizing Hybrid Scores...")
    n_params = {
        'lightgbm': load_normalization_params('lightgbm', models_dir),
        'random_forest': load_normalization_params('random_forest', models_dir),
        'logistic': load_normalization_params('logistic', models_dir),
        'anomaly': load_normalization_params('anomaly', models_dir)
    }
    
    norm_lgb = min_max_normalize_array(raw_lgb, n_params['lightgbm']['min'], n_params['lightgbm']['max'])
    norm_rf = min_max_normalize_array(raw_rf, n_params['random_forest']['min'], n_params['random_forest']['max'])
    norm_lr = min_max_normalize_array(raw_lr, n_params['logistic']['min'], n_params['logistic']['max'])
    norm_ano = min_max_normalize_array(raw_anomaly, n_params['anomaly']['min'], n_params['anomaly']['max'])
    
    w = config['weights']
    df['lgb_norm'] = norm_lgb
    df['rf_norm'] = norm_rf
    df['logistic_norm'] = norm_lr
    df['anomaly_norm'] = norm_ano
    
    df['final_risk_score'] = (
        (w['lightgbm'] * norm_lgb) +
        (w['random_forest'] * norm_rf) +
        (w['logistic'] * norm_lr) +
        (w['anomaly'] * norm_ano)
    ).clip(0.0, 1.0)
    
    out_path = os.path.join(config['paths']['results_dir'], 'predictions.csv')
    os.makedirs(config['paths']['results_dir'], exist_ok=True)
    df[['user_id', 'lgb_norm', 'rf_norm', 'logistic_norm', 'anomaly_norm', 'final_risk_score', 'label']].to_csv(out_path, index=False)
    
    print(f"[+] Prediction complete! Saved to {out_path}")

if __name__ == '__main__':
    run()
