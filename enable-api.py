import google.auth
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests
import time

SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]

creds = service_account.Credentials.from_service_account_file(
    "telegram-bot/serviceAccountKey.json", scopes=SCOPES
)
creds.refresh(Request())

headers = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"}

# Enable Firestore API
print("=== Enabling Firestore API ===")
url = "https://serviceusage.googleapis.com/v1beta1/projects/reel-insights-editor/services/firestore.googleapis.com:enable"
resp = requests.post(url, headers=headers)
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    print("Firestore API enabled!")
    print("Waiting for propagation...")
    time.sleep(5)
elif resp.status_code == 409:
    print("Already enabled")
else:
    print(resp.text)

# Also enable Firestore API for the web
print("\n=== Enabling all Firestore-related APIs ===")
apis_to_enable = [
    "firestore.googleapis.com",
    "firebaserules.googleapis.com",
]
for api in apis_to_enable:
    url2 = f"https://serviceusage.googleapis.com/v1beta1/projects/reel-insights-editor/services/{api}:enable"
    resp2 = requests.post(url2, headers=headers)
    print(f"{api}: {resp2.status_code}")
    if resp2.status_code in [200, 409]:
        print(f"  -> OK (enabled or already enabled)")
    else:
        print(f"  -> {resp2.text[:200]}")
