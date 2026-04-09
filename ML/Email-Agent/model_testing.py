import joblib
import pandas as pd

model = joblib.load("phishing_model.pkl")

df = pd.read_csv("dataset/enron_spam_data.csv")

while True:
    print("\nChoose option:")
    print("1 - Test real spam sample")
    print("2 - Test real ham sample")
    print("3 - Exit")

    choice = input("Enter choice: ")

    if choice == "1":
        sample = df[df["Spam/Ham"] == "spam"].sample(1).iloc[0]
        text = sample["Subject"] + " " + sample["Message"]
        print("\nUsing REAL SPAM sample\n")

    elif choice == "2":
        sample = df[df["Spam/Ham"] == "ham"].sample(1).iloc[0]
        text = sample["Subject"] + " " + sample["Message"]
        print("\nUsing REAL HAM sample\n")

    elif choice == "3":
        break

    else:
        print("Invalid choice")
        continue

    prediction = model.predict([text])[0]
    prob = model.predict_proba([text])[0][1]

    print("Risk Score:", round(prob, 4))
    print("Classification:", "Phishing" if prediction == 1 else "Legitimate")
    print("-" * 40)