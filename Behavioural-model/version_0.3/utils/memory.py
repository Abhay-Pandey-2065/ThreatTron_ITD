import gc
import pandas as pd

def optimize_dtypes(df):
    """Downcast datatypes to save memory."""
    for col in df.select_dtypes(include=['float64']).columns:
        df[col] = df[col].astype('float32')
    for col in df.select_dtypes(include=['int64']).columns:
        df[col] = df[col].astype('int32')
    return df

def clean_memory():
    """Force garbage collection to free memory."""
    gc.collect()
