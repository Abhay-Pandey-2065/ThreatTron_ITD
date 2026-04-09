import os
import yaml
import pandas as pd
import numpy as np
from collections import defaultdict
from utils.memory import clean_memory

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

data_dir = config['paths']['data_dir']
out_dir = config['paths']['processed_data_dir']
chunk_size = config['pipeline']['chunk_size']

def run():
    print("[*] Starting Ultra-Advanced Load and Merge (V0.4)...")
    os.makedirs(out_dir, exist_ok=True)
    
    # Advanced Multi-Dimensional Feature Tracking
    stats = defaultdict(lambda: {
        'total_logons': 0, 'after_hours_logons': 0, 'weekend_logons': 0, 'failed_logons': 0,
        'total_emails': 0, 'emails_with_attachments': 0, 'external_emails': 0, 'total_email_bytes': 0,
        'total_http': 0, 'suspicious_http': 0,
        'total_file': 0, 'exe_zip_files': 0, 'after_hours_file_ops': 0,  # NEW: night/weekend file activity
        'total_device': 0
    })
    pcs_tracked     = defaultdict(set)
    domains_tracked    = defaultdict(set)  # NEW: unique HTTP domains per user
    recipients_tracked = defaultdict(set)  # NEW: unique external email recipients per user

    # 1. Processing Logon (Temporal Anomalies + Lateral Movement)
    logon_path = os.path.join(data_dir, 'logon.csv')
    if os.path.exists(logon_path):
        print("[+] Processing logon.csv for temporal anomalies and Lateral Movement...")
        try:
            for chunk in pd.read_csv(logon_path, chunksize=chunk_size, usecols=['user', 'date', 'activity', 'pc']):
                try:
                    # Robust exact-format datetime parsing prevents crashing!
                    dt = pd.to_datetime(chunk['date'], format='%m/%d/%Y %H:%M:%S', errors='coerce')
                    chunk['hour'] = dt.dt.hour
                    chunk['dayofweek'] = dt.dt.dayofweek
                    
                    chunk['is_after_hours'] = ((chunk['hour'] < 6) | (chunk['hour'] > 19)).fillna(0).astype(int)
                    chunk['is_weekend'] = (chunk['dayofweek'] >= 5).fillna(0).astype(int)
                    chunk['is_fail'] = chunk['activity'].str.contains('Fail', case=False, na=False).astype(int)
                    
                    for user, count in chunk.groupby('user').size().items():
                         stats[user]['total_logons'] += count
                    for user, ah_count in chunk.groupby('user')['is_after_hours'].sum().items():
                         stats[user]['after_hours_logons'] += ah_count
                    for user, we_count in chunk.groupby('user')['is_weekend'].sum().items():
                         stats[user]['weekend_logons'] += we_count
                    for user, fail_count in chunk.groupby('user')['is_fail'].sum().items():
                         stats[user]['failed_logons'] += fail_count
                    
                    # Lateral Movement: Distinct PCs
                    for user, pcs in chunk.groupby('user')['pc'].apply(set).items():
                        pcs_tracked[user].update(pcs)
                        
                except Exception as e:
                    print(f"  [!] Soft error in logon chunk: {e}")
                clean_memory()
        except Exception as e:
            print(f"  [!] Failed processing logon: {e}")

    # 2. Processing Email (Attachments & Exfiltration Targets)
    email_path = os.path.join(data_dir, 'email.csv')
    if os.path.exists(email_path):
        print("[+] Processing email.csv for external domain targets & massive payloads...")
        try:
            for chunk in pd.read_csv(email_path, chunksize=chunk_size, usecols=['user', 'to', 'size', 'attachments']):
                try:
                    chunk['has_attachment'] = (pd.to_numeric(chunk['attachments'], errors='coerce') > 0).astype(int)
                    chunk['is_external'] = (~chunk['to'].str.contains('dtaa.com', case=False, na=False)).astype(int)
                    chunk['size'] = pd.to_numeric(chunk['size'], errors='coerce').fillna(0)

                    for user, count in chunk.groupby('user').size().items():
                        stats[user]['total_emails'] += count
                    for user, att_count in chunk.groupby('user')['has_attachment'].sum().items():
                        stats[user]['emails_with_attachments'] += att_count
                    for user, ext_count in chunk.groupby('user')['is_external'].sum().items():
                        stats[user]['external_emails'] += ext_count
                    for user, total_bytes in chunk.groupby('user')['size'].sum().items():
                        stats[user]['total_email_bytes'] += total_bytes
                    # NEW: unique external recipients per user
                    ext_chunk = chunk[chunk['is_external'] == 1]
                    for user, recip_set in ext_chunk.groupby('user')['to'].apply(set).items():
                        recipients_tracked[user].update(recip_set)
                except Exception as e:
                    pass
                clean_memory()
        except Exception as e:
             print(f"  [!] Failed processing email: {e}")

    # 3. Processing File
    file_path = os.path.join(data_dir, 'file.csv')
    if os.path.exists(file_path):
        print("[+] Processing file.csv for suspicious extensions + after-hours file ops...")
        file_pattern = r'\.(?:exe|zip|rar|ps1|bat|sh|vbs|tar|gz|7z)$'
        try:
            for chunk in pd.read_csv(file_path, chunksize=chunk_size, usecols=['user', 'filename', 'date']):
                try:
                    chunk['is_suspicious'] = chunk['filename'].str.contains(file_pattern, case=False, na=False).astype(int)
                    # NEW: after-hours file operations
                    dt = pd.to_datetime(chunk['date'], format='%m/%d/%Y %H:%M:%S', errors='coerce')
                    chunk['hour'] = dt.dt.hour
                    chunk['is_after_hours'] = ((chunk['hour'] < 6) | (chunk['hour'] > 19)).fillna(0).astype(int)

                    for user, count in chunk.groupby('user').size().items():
                        stats[user]['total_file'] += count
                    for user, sus_count in chunk.groupby('user')['is_suspicious'].sum().items():
                        stats[user]['exe_zip_files'] += sus_count
                    for user, ah_count in chunk.groupby('user')['is_after_hours'].sum().items():
                        stats[user]['after_hours_file_ops'] += int(ah_count)
                except Exception as e:
                    pass
                clean_memory()
        except Exception as e:
             pass

    # 4. Processing Device (USB Drives)
    device_path = os.path.join(data_dir, 'device.csv')
    if os.path.exists(device_path):
        print("[+] Processing device.csv for USB usage...")
        try:
            for chunk in pd.read_csv(device_path, chunksize=chunk_size, usecols=['user']):
                for user, count in chunk.groupby('user').size().items():
                    stats[user]['total_device'] += count
                clean_memory()
        except Exception as e:
            pass

    # 5. Processing HTTP
    http_path = os.path.join(data_dir, 'http.csv')
    if os.path.exists(http_path):
        print("[+] Processing 14.5GB http.csv for flagged domains + unique domain tracking...")
        sus_pattern = r'(?:job|upload|drive|dropbox|keylog|wikileaks|mega|pastebin|github|gmail|freemail|crypto|tor|vimeo)'

        def extract_domain(url):
            try:
                u = str(url).split('://')[-1]
                return u.split('/')[0].split('?')[0].lower()
            except:
                return ''

        try:
            for chunk_idx, chunk in enumerate(pd.read_csv(http_path, chunksize=chunk_size, usecols=['user', 'url'])):
                if chunk_idx % 10 == 0: print(f"  -> Processed {chunk_idx * chunk_size} HTTP rows...")
                try:
                    chunk['is_sus_url'] = chunk['url'].str.contains(sus_pattern, case=False, na=False).astype(int)
                    chunk['domain'] = chunk['url'].apply(extract_domain)  # NEW
                    for user, count in chunk.groupby('user').size().items():
                        stats[user]['total_http'] += count
                    for user, sus_count in chunk.groupby('user')['is_sus_url'].sum().items():
                        stats[user]['suspicious_http'] += sus_count
                    # NEW: track unique domains per user
                    for user, domain_set in chunk.groupby('user')['domain'].apply(set).items():
                        domains_tracked[user].update(domain_set)
                except Exception as e:
                    pass
                clean_memory()
        except Exception as e:
             pass

    print("[+] Building Core User DataFrame Matrix...")
    df = pd.DataFrame.from_dict(stats, orient='index').reset_index()
    if df.empty:
        print("[!] Absolute failure: No users extracted. Check data path.")
        return
        
    df.rename(columns={'index': 'user_id'}, inplace=True)
    df['num_distinct_pcs']          = df['user_id'].apply(lambda x: len(pcs_tracked.get(x, set())))
    df['unique_http_domains']       = df['user_id'].apply(lambda x: len(domains_tracked.get(x, set())))    # NEW
    df['unique_external_recipients'] = df['user_id'].apply(lambda x: len(recipients_tracked.get(x, set()))) # NEW
    df['total_email_megabytes']     = df['total_email_bytes'] / (1024 * 1024)
    df.drop(columns=['total_email_bytes'], inplace=True)
    # LDAP (role/department) and Psychometric (O,C,E,A,N) intentionally excluded:
    # they are not collectable from real-world agents and inflate the feature space with 91 unusable columns.
    
    # Merge Ground Truth (insiders.csv)
    insiders_path = config['paths']['insiders_csv']
    if os.path.exists(insiders_path):
        insiders = pd.read_csv(insiders_path)
        if 'user' in insiders.columns and 'user_id' not in insiders.columns:
            insiders.rename(columns={'user': 'user_id'}, inplace=True)
        insiders['label'] = 1
        if 'user_id' in insiders.columns:
            df = pd.merge(df, insiders[['user_id', 'label']].drop_duplicates(), on='user_id', how='left')
            df['label'] = df['label'].fillna(0).astype('int32')
        else:
            df['label'] = 0
    else:
        df['label'] = 0
        
    out_path = os.path.join(out_dir, '01_merged.csv')
    df.to_csv(out_path, index=False)
    print(f"[+] Multi-Context Dimensional Merge complete. Output shape: {df.shape}. Saved to {out_path}")

if __name__ == '__main__':
    run()
