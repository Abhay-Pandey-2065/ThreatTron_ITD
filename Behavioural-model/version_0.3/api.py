from flask import Flask, request, jsonify
import numpy as np
import yaml
import joblib
import os
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

app = Flask(__name__)

START_TIME = time.time()

print("[*] Booting up ThreatTron AI Engine...")

# -----------------------------
# 🔧 LOAD CONFIG + MODELS
# -----------------------------
try:
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)

    models_dir = os.path.join(os.getcwd(), config['paths']['models_dir'])

    feature_schema = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
    scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
    lgb_model = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    rf_model = joblib.load(os.path.join(models_dir, 'v1_rf.pkl'))
    lr_model = joblib.load(os.path.join(models_dir, 'v1_logistic.pkl'))
    iso_model = joblib.load(os.path.join(models_dir, 'v1_isolation.pkl'))

    print("[+] Models loaded successfully.")

except Exception as e:
    print(f"[-] CRITICAL ERROR: {e}")
    raise e

# -----------------------------
# ⚡ PARALLEL MODEL INFERENCE
# -----------------------------
def run_models(X):
    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(lgb_model.predict_proba, X),
            executor.submit(rf_model.predict_proba, X),
            executor.submit(lr_model.predict_proba, X),
            executor.submit(iso_model.score_samples, X)
        ]

        lgb = futures[0].result()[0, 1]
        rf = futures[1].result()[0, 1]
        lr = futures[2].result()[0, 1]
        iso_out = futures[3].result()[0]

    return lgb, rf, lr, iso_out


# -----------------------------
# ⚡ CACHE LAYER
# -----------------------------
@lru_cache(maxsize=1000)
def cached_predict(tuple_input):
    data = dict(tuple_input)

    # Base metrics
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

    # Feature engineering
    eps = 1.0
    tot_actions = sum([
        base['total_logons'], base['total_emails'],
        base['total_http'], base['total_file'], base['total_device']
    ])
    safe_actions = tot_actions + eps

    engineered = base.copy()
    engineered['total_actions'] = tot_actions
    engineered['after_hours_ratio'] = base['after_hours_logons'] / (base['total_logons'] + eps)
    engineered['attachment_ratio'] = base['emails_with_attachments'] / (base['total_emails'] + eps)
    engineered['suspicious_file_ratio'] = base['exe_zip_files'] / (base['total_file'] + eps)
    engineered['suspicious_http_ratio'] = base['suspicious_http'] / (base['total_http'] + eps)
    engineered['device_action_ratio'] = base['total_device'] / safe_actions

    tot_flags = (
        base['after_hours_logons'] +
        base['emails_with_attachments'] +
        base['exe_zip_files'] +
        base['suspicious_http']
    )

    engineered['total_suspicious_flags'] = tot_flags
    engineered['overall_suspicious_ratio'] = tot_flags / safe_actions
    engineered['exfiltration_intensity'] = (
        base['suspicious_http'] +
        base['emails_with_attachments'] +
        base['total_device']
    ) / safe_actions
    engineered['activity_intensity'] = tot_actions

    # -----------------------------
    # ⚡ NUMPY INSTEAD OF PANDAS
    # -----------------------------
    feature_vector = [engineered.get(col, 0) for col in feature_schema]
    X = np.array([feature_vector])

    X_scaled = scaler.transform(X)

    # -----------------------------
    # ⚡ PARALLEL MODELS
    # -----------------------------
    lgb, rf, lr, iso_out = run_models(X_scaled)

    iso_score = np.clip((-iso_out - 0.3) / 0.5, 0.0, 1.0)

    # Ensemble
    w = config['weights']
    final_risk = (
        (lgb * w['lightgbm']) +
        (rf * w['random_forest']) +
        (lr * w['logistic']) +
        (iso_score * w['anomaly'])
    )

    final_risk = float(np.clip(final_risk, 0.0, 1.0))
    is_threat = bool(final_risk >= config['thresholds']['risk_score'])

    return {
        "risk_score": round(final_risk, 4),
        "is_threat": is_threat,
        "lgb": float(lgb),
        "iso": float(iso_score)
    }


# -----------------------------
# 🔥 MAIN API
# -----------------------------
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        user_id = data.get("user_id", "Unknown")

        # Convert dict → tuple (for cache key)
        tuple_input = tuple(sorted(data.items()))

        result = cached_predict(tuple_input)

        return jsonify({
            "user_id": user_id,
            "risk_score": result["risk_score"],
            "is_threat": result["is_threat"],
            "sub_scores": {
                "lightgbm_confidence": round(result["lgb"], 4),
                "anomaly_confidence": round(result["iso"], 4)
            },
            "status": "success"
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


# -----------------------------
# 🚀 ENTRY POINT
# -----------------------------
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    print(f"[+] Running on port {port}")
    app.run(host='0.0.0.0', port=port)