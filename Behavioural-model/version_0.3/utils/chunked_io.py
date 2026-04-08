import pandas as pd
from .memory import optimize_dtypes

def load_csv_in_chunks(filepath, chunksize=100000, usecols=None):
    """Generator to load large CSVs strictly in chunks."""
    for chunk in pd.read_csv(filepath, chunksize=chunksize, usecols=usecols):
        yield optimize_dtypes(chunk)
