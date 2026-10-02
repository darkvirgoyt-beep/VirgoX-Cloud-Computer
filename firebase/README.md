# VirgoX Firebase CLI Authorization

This backend moves browser authorization off the local `127.0.0.1:8888` server.

## Flow

1. `vxc auth login` asks the local VirgoX bridge for a one-time code.
2. The CLI registers that code with the Firebase Cloud Function using a random client secret.
3. The CLI prints the public Firebase Hosting URL.
4. The browser signs in with Firebase Authentication.
5. The Cloud Function verifies the Firebase ID token and issues a one-time exchange ticket.
6. The CLI exchanges the ticket with the local VirgoX bridge and receives its normal local session token.

Firebase ID tokens are never stored in Firestore.

## One-time setup

Enable **Email/Password** in Firebase Authentication, create a Firebase Web App, and install the Firebase CLI.

From this directory:

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc with your Firebase project ID
# edit public/config.js with the Web App config and Cloud Function URL
cd functions
npm install
cd ..
firebase deploy
```

Firebase Hosting provides HTTPS automatically. Cloud Functions verify Firebase ID tokens server-side.

After deployment, set the CLI backend URL in your VirgoX environment:

```bash
export VIRGOX_AUTH_BACKEND="https://asia-south1-YOUR_FIREBASE_PROJECT_ID.cloudfunctions.net/vxcAuth"
export VIRGOX_AUTH_WEB="https://YOUR_FIREBASE_PROJECT_ID.web.app"
```

Then run:

```bash
vxc auth login
```
