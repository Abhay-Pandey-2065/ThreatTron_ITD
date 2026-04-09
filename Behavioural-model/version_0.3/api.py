from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import yaml
import joblib
import os

app = Flask(__name__)

# Load config and models at startup to keep the API blazing fast
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

models_dir = config['paths']['models_dir']
print("[*] Booting up ThreatTron AI Engine...")

try:
    feature_schema = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
    scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
    lgb_model = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    rf_model = joblib.load(os.path.join(models_dir, 'v1_rf.pkl'))
    # lr_model = joblib.load(os.path.join(models_dir, 'v1_logistic.pkl')) # Disabled due to Scikit-Learn 1.8.0 versioning bug on AWS
    iso_model = joblib.load(os.path.join(models_dir, 'v1_isolation.pkl'))
    print("[+] All AI models loaded into memory successfully.")
except Exception as e:
    print(f"[-] Critical Error loading models. Did you run 04_train.py? Error: {e}")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        user_id = data.get("user_id", "Unknown")
        
        # 1. Base Metrics (From your Agent)
        base = {
            'total_logons': data.get('total_logons', 0),
            'after_hours_logons': data.get('after_hours_logons', 0),
            'total_emails': data.get('total_emails', 0),
            'emails_with_attachments': data.get('emails_with_attachments', 0),
            'total_http': data.get('total_http', 0),
            'suspicious_http': data.get('suspicious_http', 0),
            'total_file': data.get('total_file', 0),
            'exe_zip_files': data.get('exe_zip_files', 0),
            'total_device': data.get('total_device', 0)
        }
        
        # 2. Dynamic Feature Engineering (The Bridge Math)
        eps = 1.0
        tot_actions = sum([base['total_logons'], base['total_emails'], base['total_http'], base['total_file'], base['total_device']])
        safe_actions = tot_actions + eps
        
        engineered = base.copy()
        engineered['total_actions'] = tot_actions
        engineered['after_hours_ratio'] = base['after_hours_logons'] / (base['total_logons'] + eps)
        engineered['attachment_ratio'] = base['emails_with_attachments'] / (base['total_emails'] + eps)
        engineered['suspicious_file_ratio'] = base['exe_zip_files'] / (base['total_file'] + eps)
        engineered['suspicious_http_ratio'] = base['suspicious_http'] / (base['total_http'] + eps)
        engineered['device_action_ratio'] = base['total_device'] / safe_actions
        
        tot_flags = base['after_hours_logons'] + base['emails_with_attachments'] + base['exe_zip_files'] + base['suspicious_http']
        engineered['total_suspicious_flags'] = tot_flags
        engineered['overall_suspicious_ratio'] = tot_flags / safe_actions
        engineered['exfiltration_intensity'] = (base['suspicious_http'] + base['emails_with_attachments'] + base['total_device']) / safe_actions
        engineered['activity_intensity'] = tot_actions
        
        # 3. Format strictly to the schema the ML model trained on
        df = pd.DataFrame([engineered])
        # Ensure column order matches exactly and fill missing V0.4 HR/Psycho context with 0
        df = df.reindex(columns=feature_schema, fill_value=0)
        
        # 4. Scale and Predict (The Brain)
        X_scaled = scaler.transform(df)
        
        lgb_score = lgb_model.predict_proba(X_scaled)[0, 1]
        rf_score = rf_model.predict_proba(X_scaled)[0, 1]
        lr_score = 0.0 # Disabled
        
        iso_out = iso_model.score_samples(X_scaled)[0]
        # Normalize Identity Forest negative scores to a rough 0-1 scale
        iso_score = np.clip((-iso_out - 0.3) / 0.5, 0.0, 1.0) 
        
        # 5. Hybrid Ensemble
        w = config['weights']
        final_risk = (
            (lgb_score * w['lightgbm']) + 
            (rf_score * w['random_forest']) + 
            (lr_score * w['logistic']) + 
            (iso_score * w['anomaly'])
        )
        
        # Force strict 0.0 to 1.0 boundary
        final_risk = float(np.clip(final_risk, 0.0, 1.0))
        is_threat = bool(final_risk >= config['thresholds']['risk_score'])
        
        return jsonify({
            "user_id": user_id,
            "risk_score": round(final_risk, 4),
            "is_threat": is_threat,
            "sub_scores": {
                "lightgbm_confidence": round(float(lgb_score), 4),
                "anomaly_confidence": round(float(iso_score), 4)
            },
            "status": "success"
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    print("[+] ThreatTron API Listener active on port 5000!")
    print("    Send a POST request to http://127.0.0.1:5000/predict")
    app.run(host='127.0.0.1', port=5000, debug=False)
