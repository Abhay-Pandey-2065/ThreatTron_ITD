import os
import yaml
import joblib
import pandas as pd
import shap

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)

def run():
    print("[*] Generating Global SHAP Explanations...")
    in_path = os.path.join(config['paths']['processed_data_dir'], '03_preprocessed.csv')
    df = pd.read_csv(in_path)
    
    models_dir = config['paths']['models_dir']
    try:
        features = joblib.load(os.path.join(models_dir, 'feature_schema.pkl'))
        scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
        lgb_model = joblib.load(os.path.join(models_dir, 'v1_lightgbm.pkl'))
    except Exception as e:
        print(f"[-] Missing models/schema: {e}")
        return
        
    X_scaled = scaler.transform(df[features])
    
    print("[+] Compiling TreeExplainer computations...")
    explainer = shap.TreeExplainer(lgb_model)
    shap_values = explainer.shap_values(X_scaled)
    
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
        
    explanations = []
    for i in range(len(df)):
        user_id = df.iloc[i]['user_id']
        vals = shap_values[i]
        top_idx = vals.argsort()[-3:][::-1] 
        top_feats = [features[j] for j in top_idx]
        explanations.append({
            'user_id': user_id,
            'top_feature_1': top_feats[0] if len(top_feats) > 0 else None,
            'top_feature_2': top_feats[1] if len(top_feats) > 1 else None,
            'top_feature_3': top_feats[2] if len(top_feats) > 2 else None
        })
        
    exp_df = pd.DataFrame(explanations)
    os.makedirs(config['paths']['results_dir'], exist_ok=True)
    out_path = os.path.join(config['paths']['results_dir'], 'explanations.csv')
    exp_df.to_csv(out_path, index=False)
    
    print(f"[+] Local Feature explanations computed! Saved to {out_path}")

if __name__ == '__main__':
    run()
