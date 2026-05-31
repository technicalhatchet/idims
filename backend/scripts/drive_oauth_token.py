#!/usr/bin/env python3
"""
One-time helper: obtain GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN for personal Google Drive.

Prerequisites:
  1. Google Cloud project with Drive API enabled
  2. OAuth 2.0 Client ID (Desktop app) — download JSON as credentials.json
  3. pip install google-auth-oauthlib

Usage (from backend/):
  python scripts/drive_oauth_token.py path/to/credentials.json

Then set on Railway:
  GOOGLE_DRIVE_OAUTH_CLIENT_ID
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  GOOGLE_DRIVE_ROOT_FOLDER_ID  (receipts folder in YOUR Drive)
  GOOGLE_DRIVE_PHOTOS_ROOT_FOLDER_ID  (work order photos folder)
"""

from __future__ import annotations

import sys
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/drive"]


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/drive_oauth_token.py path/to/credentials.json")
        sys.exit(1)

    cred_path = Path(sys.argv[1])
    if not cred_path.is_file():
        print(f"File not found: {cred_path}")
        sys.exit(1)

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print("Install: pip install google-auth-oauthlib")
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(str(cred_path), SCOPES)
    creds = flow.run_local_server(port=0)

    print("\n--- Add these to Railway (backend) ---\n")
    print(f"GOOGLE_DRIVE_OAUTH_CLIENT_ID={creds.client_id}")
    print(f"GOOGLE_DRIVE_OAUTH_CLIENT_SECRET={creds.client_secret}")
    print(f"GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN={creds.refresh_token}")
    print("\nCreate a folder in your personal Drive, copy its ID from the URL:")
    print("GOOGLE_DRIVE_ROOT_FOLDER_ID=<receipts-folder-id-from-drive-url>")
    print("GOOGLE_DRIVE_PHOTOS_ROOT_FOLDER_ID=<photos-folder-id-from-drive-url>")
    print("\nImportant: use a NEW refresh token after each scope change (revoke old access at")
    print("https://myaccount.google.com/permissions if uploads still fail).")
    print("\nYou can remove GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON — not needed for personal Gmail.")


if __name__ == "__main__":
    main()
