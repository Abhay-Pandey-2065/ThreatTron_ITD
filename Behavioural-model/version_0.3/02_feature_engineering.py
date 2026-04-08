import os
import yaml
import pandas as pd
import numpy as np
from utils.memory import optimize_dtypes

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Advanced Feature Vector Engineering (V0.4)...")
    in_path = os.path.join(config['paths']['processed_data_dir'], '01_merged.csv')
    out_path = os.path.join(config['paths']['processed_data_dir'], '02_engineered.csv')
    
    if not os.path.exists(in_path):
        return
        
    df = pd.read_csv(in_path)
    if df.empty:
        return
    
    eps = 1.0 
    
    # 0. Base Actions
    df['total_actions'] = df[['total_logons', 'total_emails', 'total_http', 'total_file', 'total_device']].sum(axis=1)
    safe_actions = df['total_actions'] + eps
    
    # 1. Temporal Anomalies
    df['after_hours_ratio'] = df['after_hours_logons'] / (df['total_logons'] + eps)
    df['weekend_activity_ratio'] = df['weekend_logons'] / (df['total_logons'] + eps)
    df['failed_logon_ratio'] = df['failed_logons'] / (df['total_logons'] + eps)
    
    # 2. Exfiltration Risk
    df['attachment_ratio'] = df['emails_with_attachments'] / (df['total_emails'] + eps)
    df['external_email_ratio'] = df['external_emails'] / (df['total_emails'] + eps)
    
    # 3. Payload & Lateral
    df['suspicious_file_ratio'] = df['exe_zip_files'] / (df['total_file'] + eps)
    df['suspicious_http_ratio'] = df['suspicious_http'] / (df['total_http'] + eps)
    df['device_action_ratio'] = df['total_device'] / safe_actions
    
    # 4. Composite Ratios
    df['total_suspicious_flags'] = (df['after_hours_logons'] + df['emails_with_attachments'] + 
                                    df['exe_zip_files'] + df['suspicious_http'] + df['external_emails'])
    df['overall_suspicious_ratio'] = df['total_suspicious_flags'] / safe_actions
    
    # 5. Heavy Intensity (Scale-aware Exfiltration)
    df['exfiltration_intensity'] = (df['suspicious_http'] + df['external_emails'] + df['total_device']) / safe_actions
    df['activity_intensity'] = df['total_actions']
    
    df.fillna(0, inplace=True)
    df = optimize_dtypes(df)
    df.to_csv(out_path, index=False)
    print(f"[+] Multi-Context Engineering complete. Engineered {df.shape[1]-2} features. Saved to {out_path}")

if __name__ == '__main__':
    run()
