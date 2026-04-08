import os
import yaml
import pandas as pd
from utils.observable_parser import parse_observable_file

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Validating Output Against Observables...")
    pred_path = os.path.join(config['paths']['results_dir'], 'predictions.csv')
    eng_path = os.path.join(config['paths']['processed_data_dir'], '02_engineered.csv')
    
    if not os.path.exists(pred_path) or not os.path.exists(eng_path):
        print("[-] Predictions or engineered data missing.")
        return
        
    preds = pd.read_csv(pred_path)
    eng_data = pd.read_csv(eng_path)
    
    # Merge engineered features to cross-examine why the model flagged them
    preds = pd.merge(preds, eng_data, on='user_id', how='left')
    
    insiders_path = config['paths']['insiders_csv']
    ans_dir = config['paths']['answers_dir']
    threshold = config['thresholds']['risk_score']
    
    val_dir = os.path.join(config['paths']['results_dir'], 'validation')
    os.makedirs(val_dir, exist_ok=True)
    os.makedirs(os.path.join(val_dir, 'per_user_validation'), exist_ok=True)
    
    flagged = preds[preds['final_risk_score'] > threshold]
    insiders = pd.read_csv(insiders_path) if os.path.exists(insiders_path) else pd.DataFrame()
    
    report_lines = ["=== RIGOROUS OBSERVABLE VALIDATION REPORT ===\n"]
    report_lines.append(f"Total Users Examined: {len(preds)}")
    report_lines.append(f"Users Flagged as Threats (> {threshold} Risk): {len(flagged)}")
    
    if insiders.empty:
        report_lines.append("No insiders.csv found. Outputting purely anomalous behavior logic without ground truth hits.")
        true_insiders = []
    else:
        if 'user' in insiders.columns and 'user_id' not in insiders.columns:
            insiders.rename(columns={'user': 'user_id'}, inplace=True)
        true_insiders = insiders['user_id'].dropna().unique()
        missed = [u for u in true_insiders if u not in flagged['user_id'].values]
        
        report_lines.append(f"True Insiders Captured: {len(true_insiders) - len(missed)} / {len(true_insiders)}")
        report_lines.append(f"Missed Insiders (False Negatives): {len(missed)}")
        
        if len(missed) > 0:
            report_lines.append("\n--- MISSED (FALSE NEGATIVES) ---")
            for m in missed:
                _score = preds.loc[preds['user_id'] == m, 'final_risk_score']
                score_v = _score.values[0] if len(_score) > 0 else "N/A"
                report_lines.append(f"User: {m} (Model Score: {score_v})")
        
    report_lines.append("\n--- PER-USER RIGOROUS VERDICTS ---\n")
    
    for _, row in flagged.iterrows():
        user = row['user_id']
        score = row['final_risk_score']
        
        # Heuristically locate observable file associated with user
        obs_filename = None
        if os.path.exists(ans_dir):
            for p_file in os.listdir(ans_dir):
                if isinstance(user, str) and user.lower() in p_file.lower() and p_file.endswith('.txt'):
                    obs_filename = os.path.join(ans_dir, p_file)
                    break
                
        obs_data = parse_observable_file(obs_filename) if obs_filename else None
            
        verdict = "CONFIRMED" if user in true_insiders else "FALSE_ALARM"
        
        # Strict Vector Intersections 
        # (Checking if pipeline flagged the user FOR THE RIGHT REASONS)
        intersection_note = ""
        if verdict == "CONFIRMED" and obs_data:
            ground_events = obs_data.get('events', {})
            primary_attack_vector = max(ground_events, key=ground_events.get) if ground_events else None
            
            if primary_attack_vector == 'http' and row['suspicious_http_ratio'] > row['suspicious_file_ratio']:
                intersection_note = " [ACCURATE VECTOR: HTTP Exfiltration Match]"
            elif primary_attack_vector == 'file' and row['suspicious_file_ratio'] > row['suspicious_http_ratio']:
                intersection_note = " [ACCURATE VECTOR: Suspicious Files Match]"
            elif primary_attack_vector == 'email' and row['attachment_ratio'] > row['suspicious_http_ratio']:
                intersection_note = " [ACCURATE VECTOR: Email Exfil Match]"
            elif primary_attack_vector == 'logon' and row['after_hours_ratio'] > 0.1:
                intersection_note = " [ACCURATE VECTOR: Temporal Logon Match]"
            else:
                 intersection_note = f" [MISMATCH VECTOR: Pipeline caught user, but attack vector ({primary_attack_vector}) wasn't the highest ratio]"
        
        report_lines.append(f"User: {user} | Score: {score:.3f} | Verdict: {verdict}{intersection_note}")
             
        # Generate per-user mini validation txt
        u_text = f"User Evaluation: {user}\nVerdict: {verdict}\nRisk Score: {score:.3f}\n"
        if obs_data:
            u_text += f"\nGround Truth Time Boundary: {obs_data.get('start_date')} to {obs_data.get('end_date')}\n"
            u_text += f"Observable Activity Breakdown:\n"
            for k, v in obs_data.get('events', {}).items():
                u_text += f"  - {k}: {v} hits\n"
        else:
            u_text += "\nNo observable document mapping log found.\n"
            
        with open(os.path.join(val_dir, 'per_user_validation', f"{str(user)}.txt"), 'w') as uf:
            uf.write(u_text)

    # Master validation
    with open(os.path.join(val_dir, 'validation_report.txt'), 'w') as f:
        f.write("\n".join(report_lines))
        
    print(f"[+] Validation Complete! Computed Overlaps & Rigorous Metrics. See {val_dir}/validation_report.txt")

if __name__ == '__main__':
    run()
