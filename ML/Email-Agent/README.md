---------------------------------------------
---------------------------------------------
---------------------------------------------

### INSTALL DEPENDENCIES : (make virtual env before installation)

pip install -r requirements.txt

---------------------------------------------
---------------------------------------------
---------------------------------------------



# Phishing Email Detection Model

## 📌 Overview

This project implements a machine learning model to classify emails as **phishing (spam)** or **legitimate (ham)** using natural language processing (NLP).

The model is trained on the **Enron Spam Dataset** and uses **TF-IDF vectorization** with **Logistic Regression** for classification.

---

## ⚙️ Features

* Combines **email subject + message body** for analysis
* Converts text into numerical features using **TF-IDF**
* Uses **bigrams (1–2 word combinations)** for better context
* Handles class imbalance using **balanced class weights**
* Outputs classification and accuracy metrics
* Saves trained model for reuse

---

## 🧠 Model Details

* **Algorithm:** Logistic Regression
* **Text Representation:** TF-IDF (max 20,000 features, n-grams: 1–2)
* **Task:** Binary Classification

  * `0` → Legitimate (Ham)
  * `1` → Phishing (Spam)

---

## 📂 Dataset

* **Name:** Enron Spam Dataset
* **Columns Used:**

  * `Subject`
  * `Message`
  * `Spam/Ham`

The dataset contains real corporate emails labeled as spam or legitimate.

---

## 🚀 Installation

1. Clone the repository:

```bash
git clone <your-repo-link>
cd <repo-name>
```

2. Create virtual environment:

```bash
python -m venv venv
```

3. Activate environment:

Windows:

```bash
venv\Scripts\activate
```

Mac/Linux:

```bash
source venv/bin/activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

---

## ▶️ Usage

### Train the model

```bash
python train_phishing_model.py
```

This will:

* Train the model
* Print accuracy and classification report
* Save model as `phishing_model.pkl`

---

## 🧪 Example Output

```
Accuracy: 0.999
Precision: 1.00
Recall: 1.00
F1-score: 1.00
```

---

## 💾 Saved Model

The trained model is saved as:

```
phishing_model.pkl
```

You can load it later using `joblib` for inference.

---

## ⚠️ Notes

* This model is trained on a **clean dataset**, so real-world performance may vary
* Short or synthetic inputs may not perform well due to training distribution
* In production systems, **raw email content should not be stored**, only extracted features

---

## 🧩 Future Improvements

* Use larger and more diverse phishing datasets
* Add metadata-based features (sender, links, attachments)
* Experiment with deep learning models (e.g., BERT)
* Deploy as an API or web application