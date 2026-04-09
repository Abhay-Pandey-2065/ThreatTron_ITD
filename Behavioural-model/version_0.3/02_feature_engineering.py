import os
import yaml
import pandas as pd
import numpy as np
from utils.memory import optimize_dtypes

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Feature Engineering V2.0 (32 Pure Behavioral Features)...")
    in_path  = os.path.join(config['paths']['processed_data_dir'], '01_merged.csv')
    out_path = os.path.join(config['paths']['processed_data_dir'], '02_engineered.csv')

    if not os.path.exists(in_path):
        print("[-] 01_merged.csv missing. Run 01_load_and_merge.py first.")
        return

    df = pd.read_csv(in_path)
    if df.empty:
        print("[-] Merged file is empty.")
        return

    eps = 1.0

    # ── GROUP 1: TOTAL ACTIONS (base denominator) ────────────────────────────
    df['total_actions'] = df[['total_logons', 'total_emails', 'total_http',
                               'total_file', 'total_device']].sum(axis=1)
    safe_actions = df['total_actions'] + eps

    # ── GROUP 2: TEMPORAL ANOMALY RATIOS ─────────────────────────────────────
    df['after_hours_ratio']       = df['after_hours_logons']   / (df['total_logons'] + eps)
    df['weekend_activity_ratio']  = df['weekend_logons']        / (df['total_logons'] + eps)
    df['failed_logon_ratio']      = df['failed_logons']         / (df['total_logons'] + eps)

    # ── GROUP 3: EMAIL EXFILTRATION RATIOS ───────────────────────────────────
    df['attachment_ratio']        = df['emails_with_attachments'] / (df['total_emails'] + eps)
    df['external_email_ratio']    = df['external_emails']          / (df['total_emails'] + eps)

    # ── GROUP 4: FILE & DEVICE RATIOS ────────────────────────────────────────
    df['suspicious_file_ratio']   = df['exe_zip_files']  / (df['total_file']  + eps)
    df['suspicious_http_ratio']   = df['suspicious_http'] / (df['total_http']  + eps)
    df['device_action_ratio']     = df['total_device']   / safe_actions

    # ── GROUP 5: COMPOSITE THREAT FLAGS ──────────────────────────────────────
    df['total_suspicious_flags'] = (
        df['after_hours_logons'] +
        df['emails_with_attachments'] +
        df['exe_zip_files'] +
        df['suspicious_http'] +
        df['external_emails']           # Key exfiltration signal
    )
    df['overall_suspicious_ratio'] = df['total_suspicious_flags'] / safe_actions

    # ── GROUP 6: EXFILTRATION & ACTIVITY INTENSITY ───────────────────────────
    df['exfiltration_intensity'] = (
        df['suspicious_http'] +
        df['external_emails'] +         # External emails = primary exfiltration vector
        df['total_device']
    ) / safe_actions
    df['activity_intensity'] = df['total_actions']

    # ── GROUP 7: NEW BEHAVIORAL DIVERSITY RATIOS ─────────────────────────────
    # after_hours_file_ratio: how much file activity happens after hours
    df['after_hours_file_ratio']  = df['after_hours_file_ops'] / (df['total_file'] + eps)

    # domain_diversity: attacker jumps many domains; normal user uses bookmarks
    df['domain_diversity']        = df['unique_http_domains']        / (df['total_http'] + eps)

    # recipient_diversity: exfiltrating to many accounts = high ratio
    df['recipient_diversity']     = df['unique_external_recipients'] / (df['external_emails'] + eps)

    df.fillna(0, inplace=True)
    df = optimize_dtypes(df)
    df.to_csv(out_path, index=False)
    print(f"[+] V2.0 Feature Engineering complete. Shape: {df.shape}. Saved to {out_path}")
    print(f"[+] Final feature count (excl. user_id + label): {df.shape[1] - 2}")

if __name__ == '__main__':
    run()
