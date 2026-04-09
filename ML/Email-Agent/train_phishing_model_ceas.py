import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, accuracy_score

df = pd.read_csv("dataset/ceas_08.csv")

# drop missing
df = df.dropna(subset=["subject", "body", "label"])

# combine text
df["text"] = (
    df["subject"] + " " +
    df["body"] + " " +
    "has_url_" + df["urls"].astype(str) + " " +
    df["sender"]
)

X = df["text"]
y = df["label"]   # already 0/1

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = Pipeline([
    ("tfidf", TfidfVectorizer(
        max_features=20000,
        ngram_range=(1,2),
        stop_words="english"
    )),
    ("clf", LogisticRegression(
        max_iter=300,
        class_weight="balanced"
    ))
])

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

print("Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))

joblib.dump(model, "phishing_model.pkl")