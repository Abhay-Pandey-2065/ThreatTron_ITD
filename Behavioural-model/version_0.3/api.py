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

# -----------------------------------------------------------------------
# 🔧 LOAD CONFIG + MODELS
# -----------------------------------------------------------------------
try:
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)

    models_dir = os.path.join(os.getcwd(), config['paths']['models_dir'])

    feature_schema = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
    scaler         = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
    lgb_model      = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    rf_model       = joblib.load(os.path.join(models_dir, 'v1_rf.pkl'))
    lr_model       = joblib.load(os.path.join(models_dir, 'v1_logistic.pkl'))
    iso_model      = joblib.load(os.path.join(models_dir, 'v1_isolation.pkl'))

    print("[+] Models loaded successfully.")

except Exception as e:
    print(f"[-] CRITICAL ERROR: {e}")
    raise e


# -----------------------------------------------------------------------
# ⚡ PARALLEL MODEL INFERENCE
# -----------------------------------------------------------------------
def run_models(X):
    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(lgb_model.predict_proba, X),
            executor.submit(rf_model.predict_proba, X),
            executor.submit(lr_model.predict_proba, X),
            executor.submit(iso_model.score_samples, X)
        ]
        lgb     = futures[0].result()[0, 1]
        rf      = futures[1].result()[0, 1]
        lr      = futures[2].result()[0, 1]
        iso_out = futures[3].result()[0]
    return lgb, rf, lr, iso_out


# -----------------------------------------------------------------------
# ⚡ ML INFERENCE WITH LRU CACHE
# -----------------------------------------------------------------------
@lru_cache(maxsize=1000)
def cached_predict(tuple_input):
    data = dict(tuple_input)

    # ── ALL 17 RAW INPUT FIELDS ───────────────────────────────────────────────
    base = {
        'total_logons':               data.get('total_logons', 0),
        'after_hours_logons':         data.get('after_hours_logons', 0),
        'weekend_logons':             data.get('weekend_logons', 0),
        'failed_logons':              data.get('failed_logons', 0),
        'total_emails':               data.get('total_emails', 0),
        'emails_with_attachments':    data.get('emails_with_attachments', 0),
        'external_emails':            data.get('external_emails', 0),
        'total_email_megabytes':      data.get('total_email_megabytes', 0),
        'total_http':                 data.get('total_http', 0),
        'suspicious_http':            data.get('suspicious_http', 0),
        'total_file':                 data.get('total_file', 0),
        'exe_zip_files':              data.get('exe_zip_files', 0),
        'after_hours_file_ops':       data.get('after_hours_file_ops', 0),
        'total_device':               data.get('total_device', 0),
        'num_distinct_pcs':           data.get('num_distinct_pcs', 0),
        'unique_http_domains':        data.get('unique_http_domains', 0),
        'unique_external_recipients': data.get('unique_external_recipients', 0),
    }

    eps = 1.0
    tot_actions  = sum([base['total_logons'], base['total_emails'],
                        base['total_http'],   base['total_file'], base['total_device']])
    safe_actions = tot_actions + eps

    engineered = base.copy()
    engineered['total_actions']           = tot_actions
    engineered['after_hours_ratio']       = base['after_hours_logons'] / (base['total_logons'] + eps)
    engineered['weekend_activity_ratio']  = base['weekend_logons']      / (base['total_logons'] + eps)
    engineered['failed_logon_ratio']      = base['failed_logons']       / (base['total_logons'] + eps)
    engineered['attachment_ratio']        = base['emails_with_attachments'] / (base['total_emails'] + eps)
    engineered['external_email_ratio']    = base['external_emails']          / (base['total_emails'] + eps)
    engineered['suspicious_file_ratio']   = base['exe_zip_files']   / (base['total_file']  + eps)
    engineered['suspicious_http_ratio']   = base['suspicious_http'] / (base['total_http']  + eps)
    engineered['device_action_ratio']     = base['total_device']    / safe_actions

    tot_flags = (
        base['after_hours_logons'] + base['emails_with_attachments'] +
        base['exe_zip_files']      + base['suspicious_http'] + base['external_emails']
    )
    engineered['total_suspicious_flags']   = tot_flags
    engineered['overall_suspicious_ratio'] = tot_flags / safe_actions
    engineered['exfiltration_intensity']   = (
        base['suspicious_http'] + base['external_emails'] + base['total_device']
    ) / safe_actions
    engineered['activity_intensity']       = tot_actions
    engineered['after_hours_file_ratio']   = base['after_hours_file_ops']       / (base['total_file']       + eps)
    engineered['domain_diversity']         = base['unique_http_domains']         / (base['total_http']       + eps)
    engineered['recipient_diversity']      = base['unique_external_recipients']  / (base['external_emails']  + eps)

    feature_vector = [engineered.get(col, 0) for col in feature_schema]
    X              = np.array([feature_vector])
    X_scaled       = scaler.transform(X)

    lgb, rf, lr, iso_out = run_models(X_scaled)
    iso_score = np.clip((-iso_out - 0.3) / 0.5, 0.0, 1.0)

    w          = config['weights']
    final_risk = ((lgb * w['lightgbm']) + (rf * w['random_forest']) +
                  (lr  * w['logistic']) + (iso_score * w['anomaly']))
    final_risk = float(np.clip(final_risk, 0.0, 1.0))

    return {
        "risk_score": round(final_risk, 4),
        "is_threat":  bool(final_risk >= config['thresholds']['risk_score']),
        "lgb":        float(lgb),
        "rf":         float(rf),
        "lr":         float(lr),
        "iso":        float(iso_score),
    }


# -----------------------------------------------------------------------
# 🔍 KILL-CHAIN RULE ENGINE (behavioural pattern detector)
# Pure logic — no retraining needed, works on any payload
# -----------------------------------------------------------------------
def run_rule_engine(data: dict):
    total_file   = data.get('total_file', 0)
    exe_files    = data.get('exe_zip_files', 0)
    total_usb    = data.get('total_device', 0)
    sus_http     = data.get('suspicious_http', 0)
    ext_email    = data.get('external_emails', 0)
    ah_file      = data.get('after_hours_file_ops', 0)
    unique_recip = data.get('unique_external_recipients', 0)

    score = 0.0
    fired = []

    # Rule 1 — USB + File copy (classic exfiltration)
    if total_usb > 0 and total_file > 5:
        score += 0.45
        fired.append("USB_FILE_EXFIL")

    # Rule 2 — Suspicious web + file staging
    if sus_http > 3 and total_file > 30:
        score += 0.30
        fired.append("SUSPICIOUS_WEB_STAGING")

    # Rule 3 — External email + file activity
    if ext_email > 3 and total_file > 30:
        score += 0.25
        fired.append("EMAIL_EXFILTRATION")

    # Rule 4 — Full kill chain (all three vectors active)
    if total_usb > 0 and sus_http > 0 and ext_email > 0:
        score += 0.40
        fired.append("FULL_KILL_CHAIN")

    # Rule 5 — Executable/archive file creation
    if exe_files > 0:
        score += 0.20
        fired.append("SUSPICIOUS_FILE_TYPES")

    # Rule 6 — After-hours file ops combined with exfiltration
    if ah_file > 0 and (total_usb > 0 or ext_email > 0):
        score += 0.25
        fired.append("AFTER_HOURS_EXFIL")

    # Rule 7 — Mass external recipient spray
    if unique_recip > 3 and ext_email > 0:
        score += 0.20
        fired.append("MASS_RECIPIENT_SPRAY")

    return min(score, 1.0), fired


# -----------------------------------------------------------------------
# 🔥 MAIN API ENDPOINT
# -----------------------------------------------------------------------
@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    # CORS pre-flight — allows Chrome to call this from any origin
    if request.method == 'OPTIONS':
        return '', 204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        }

    try:
        data    = request.json
        user_id = data.get("user_id", "Unknown")

        # ── ML inference ──────────────────────────────────────────────────────
        tuple_input = tuple(sorted(data.items()))
        ml_result   = cached_predict(tuple_input)
        ml_score    = ml_result["risk_score"]

        # ── Behavioural rule engine ────────────────────────────────────────────
        rule_score, rules_fired = run_rule_engine(data)

        # ── Blend 50 / 50 ─────────────────────────────────────────────────────
        final_score = round((ml_score * 0.5) + (rule_score * 0.5), 4)
        is_threat   = bool(final_score >= 0.45)

        response = jsonify({
            "user_id":         user_id,
            "risk_score":      final_score,
            "is_threat":       is_threat,
            "ml_score":        round(ml_score, 4),
            "rule_score":      round(rule_score, 4),
            "rules_triggered": rules_fired,
            "sub_scores": {
                "lightgbm_confidence": round(ml_result["lgb"], 4),
                "rf_confidence":       round(ml_result["rf"], 4),
                "lr_confidence":       round(ml_result["lr"], 4),
                "anomaly_confidence":  round(ml_result["iso"], 4),
            },
            "status": "success"
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response

    except Exception as e:
        resp = jsonify({"status": "error", "message": str(e)})
        resp.status_code = 400
        resp.headers.add('Access-Control-Allow-Origin', '*')
        return resp


# -----------------------------------------------------------------------
# 🚀 ENTRY POINT
# -----------------------------------------------------------------------
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    print(f"[+] Running on port {port}")
    app.run(host='0.0.0.0', port=port)