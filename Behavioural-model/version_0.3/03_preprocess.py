import os
import yaml
import numpy as np
import pandas as pd

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Starting Ultra-Advanced Preprocessing (Outlier Safety & NLP Encoding)...")
    in_path = os.path.join(config['paths']['processed_data_dir'], '02_engineered.csv')
    out_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    
    if not os.path.exists(in_path):
        print("[-] Engineered file missing.")
        return
        
    df = pd.read_csv(in_path)
    
    # 1. Extreme Outlier Safety
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.fillna(0, inplace=True)
    
    # 2. Drop structurally invalid rows
    df = df.dropna(subset=['user_id'])
    
    # 3. Categorical One-Hot Encoding for LDAP Context
    # Machine Learning models only read numbers, not strings like "Role: Sales" or "Department: IT"
    # This translates psychological and structural context into raw mathematical matrices
    categorical_cols = ['role', 'department']
    cols_to_encode = [c for c in categorical_cols if c in df.columns]
    
    if cols_to_encode:
        print(f"[+] Applying Matrix Encoding to qualitative variables: {cols_to_encode}...")
        df = pd.get_dummies(df, columns=cols_to_encode, dummy_na=True)
        # Convert the resulting True/False columns into 1 and 0 ints for ML digestion
        bool_cols = df.select_dtypes(include=['bool']).columns
        df[bool_cols] = df[bool_cols].astype(int)
    
    # 4. Percentile Clipping (Protect Scalers)
    numeric_columns = [c for c in df.columns if c not in ['user_id', 'label'] and c not in categorical_cols]
    
    # We only apply clipping to the continuous floats, not the boolean 0/1 dummies
    for col in numeric_columns:
        if df[col].dtype in ['float64', 'float32', 'int64', 'int32']:
            # Do not clip dummy variables (max is 1 anyway)
            if df[col].nunique() > 2:
                p_99_9 = df[col].quantile(0.999)
                df[col] = df[col].clip(upper=p_99_9)
    
    df.to_csv(out_path, index=False)
    print(f"[+] Multi-Context Preprocessing complete. Saved to {out_path} (shape: {df.shape})")

if __name__ == '__main__':
    run()
