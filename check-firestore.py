import google.auth
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests

SCOPES = ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/datastore"]

creds = service_account.Credentials.from_service_account_file(
    "telegram-bot/serviceAccountKey.json", scopes=SCOPES
)
creds.refresh(Request())

headers = {"Authorization": f"Bearer {creds.token}"}

# Check Firestore databases
print("=== Checking Firestore databases ===")
url = "https://firestore.googleapis.com/v1/projects/reel-insights-editor/databases"
resp = requests.get(url, headers=headers)
print(f"Status: {resp.status_code}")
print(resp.json())

# Check if Firestore API is enabled
print("\n=== Checking enabled APIs ===")
url2 = "https://serviceusage.googleapis.com/v1beta1/projects/reel-insights-editor/services/firestore.googleapis.com"
resp2 = requests.get(url2, headers=headers)
print(f"Status: {resp2.status_code}")
print(resp2.json())

# Test write directly
print("\n=== Testing direct write to keys ===")
url3 = "https://firestore.googleapis.com/v1/projects/reel-insights-editor/databases/(default)/documents/keys"
data = {
    "fields": {
        "key": {"stringValue": "RI-TEST-CONN-EC01"},
        "status": {"stringValue": "active"},
        "duration": {"stringValue": "7d"},
        "assignedTo": {"stringValue": "connection-test"}
    }
}
resp3 = requests.post(url3, headers={**headers, "Content-Type": "application/json"}, json=data)
print(f"Status: {resp3.status_code}")
if resp3.status_code == 200:
    print("Write SUCCESS - Firestore is connected!")
    # Clean up test doc
    doc_name = resp3.json().get("name", "")
    if doc_name:
        requests.delete(doc_name, headers=headers)
        print("Test doc deleted")
else:
    print(resp3.text)
