# Used for debugging errors while in the training code


import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
from sklearn.linear_model import LogisticRegression
from scipy.sparse import hstack, csr_matrix
import joblib

df = pd.read_csv("datasets/enron_spam_dataset.csv")