import joblib
import os
import numpy as np

def min_max_normalize_array(scores, min_v, max_v):
    if max_v - min_v == 0:
        return np.zeros_like(scores, dtype=np.float32)
    norm = (scores - min_v) / (max_v - min_v)
    return np.clip(norm, 0.0, 1.0)

def save_normalization_params(name, scores, models_dir):
    min_v = float(np.min(scores))
    max_v = float(np.max(scores))
    path = os.path.join(models_dir, f"{name}_norm.pkl")
    joblib.dump({'min': min_v, 'max': max_v}, path)
    return min_v, max_v

def load_normalization_params(name, models_dir):
    path = os.path.join(models_dir, f"{name}_norm.pkl")
    if os.path.exists(path):
        return joblib.load(path)
    return {'min': 0.0, 'max': 1.0}
