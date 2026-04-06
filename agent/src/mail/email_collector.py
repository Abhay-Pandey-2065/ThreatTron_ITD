from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import os.path
import pickle

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, "credentials.json")
TOKEN_PATH = os.path.join(BASE_DIR, "token.pickle")

COMPANY_DOMAIN = ""

class GmailCollector:
    def __init__(self):
        self.service = self.authenticate()

    def authenticate(self):
        creds = None

        if os.path.exists(TOKEN_PATH):
            with open("token.pickle", "rb") as token:
                creds = pickle.load(token)

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        
        if not creds or not creds.valid:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

            with open(TOKEN_PATH, "wb") as token:
                pickle.dump(creds, token)

        return build("gmail", "v1", credentials=creds)
    
    def fetch_recent_emails(self, max_result=5):
        results = self.service.users().messages().list(
            userId = "me",
            maxResults = max_result
        ).execute()

        messages = results.get("messages", [])
        return messages
    
    def get_messages(self, msg_id):
        message = self.service.users().messages().get(
            userId = "me",
            id = msg_id,
            format = "full"
        ).execute()
        return message
    
    def extract_features(self, message):
        headers = message["payload"]["headers"]
        subject = None
        sender = None
        recipient = None

        for header in headers:
            if header["name"] == "Subject":
                subject = header["value"]
            if header["name"] == "From":
                sender = header["value"]
            if header["name"] == "To":
                recipient = header["value"]
        
        snippet = message.get("snippet", "")

        is_external = False
        if recipient:
            addresses = [addr.strip() for addr in recipient.split(",")]
            for addr in addresses:
                if "<" in addr:
                    addr = addr.split("<")[-1].strip(">").strip()
                domain = addr.split("@")[-1].lower() if "@" in addr else ""
                if domain and domain != COMPANY_DOMAIN.lower():
                    is_external = True
                    break

        return {
            "sender": sender,
            "subject": subject,
            "snippet_length": len(snippet),
            "has_links": "http" in snippet.lower(),
            "recipient": recipient,
            "is_external": is_external
        }