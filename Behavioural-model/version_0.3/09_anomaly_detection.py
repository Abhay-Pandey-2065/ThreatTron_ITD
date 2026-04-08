import os
import yaml
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from utils.normalization import save_normalization_params

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Unsupervised Training (Anomaly Detection)...")
    if not config['pipeline']['train_models']:
        print("[!] train_models is false in config.yaml. Skipping anomaly training.")
        return
        
    in_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    df = pd.read_csv(in_path)
    
    # Train ONLY on normal users (label=0) to establish a truly clean baseline
    normal_df = df[df['label'] == 0]
    if normal_df.empty:
        print("[!] No normal users found to train IsolationForest.")
        return
        
    try:
        features = joblib.load(os.path.join(config['paths']['models_dir'], 'feature_schema.pkl'))
        scaler = joblib.load(os.path.join(config['paths']['models_dir'], 'scaler.pkl'))
    except Exception as e:
        print(f"[-] Wait for supervised pipeline first for schema sharing: {e}")
        return
        
    X_normal = normal_df[features]
    X_scaled = scaler.transform(X_normal)
    
    print("[+] Training Isolation Forest on normal baseline...")
    # CERT r4.2 is known to have ~70-100 malicious instances among ~4000 users. 
    # Therefore, true contamination is around 1.7%-2.5%. 
    # We set contamination exactly to 0.02 to avoid throwing too many false alarms 
    # while strictly finding the exact 2% of anomalous behaviours.
    iso = IsolationForest(
        n_estimators=150, 
        max_samples='auto',
        contamination=0.02, 
        n_jobs=-1, 
        random_state=42
    )
    iso.fit(X_scaled)
    
    joblib.dump(iso, os.path.join(config['paths']['models_dir'], 'v1_isolation.pkl'))
    
    # Negative scores because smaller values in IsolationForest correlate to anomalies. 
    # By negating, Higher Score = Higher Anomaly.
    scores = -iso.score_samples(X_scaled)
    save_normalization_params('anomaly', scores, config['paths']['models_dir'])
    
    print("[+] Anomaly model trained and saved!")

if __name__ == '__main__':
    run()
