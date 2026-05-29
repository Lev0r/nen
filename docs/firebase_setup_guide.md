# Firebase Setup & Deployment Guide

This guide will walk you through creating your Firebase project from scratch, enabling the required services, extracting your environment variables, and deploying the application.

> [!NOTE]
> You only need to do the Console Setup (Steps 1-3) once. 

## 1. Create the Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name the project (e.g., "Nen Tracker").
3. You can disable Google Analytics (it's not needed for this app) and click **Create project**.
4. Once created, you will be taken to the Project Overview page.
5. Click the **Web icon** (`</>`) to add a web app to your project.
6. Register the app with a nickname (e.g., "Nen Web App"). Do not check "Also set up Firebase Hosting" just yet.
7. Click **Register app**. You will be presented with a `firebaseConfig` object.
8. **Copy the values** from that config into your local `c:\Work\nen\.env.local` file matching the `VITE_FIREBASE_*` variables.

## 2. Enable Authentication

1. In the left sidebar of the Firebase Console, go to **Build > Authentication**.
2. Click **Get started**.
3. Go to the **Sign-in method** tab and click **Add new provider**.
4. Select **Google**.
5. Enable it, provide a support email (your email), and click **Save**.

## 3. Enable Firestore Database

1. In the left sidebar, go to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location close to you and click **Next**.
4. Start in **Production mode** (we've already defined security rules locally) and click **Create**.

## 4. Local CLI Setup

To deploy the app from your terminal, you need the Firebase CLI tools.

1. Install the Firebase CLI globally on your machine:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Google Account from the terminal:
   ```bash
   firebase login
   ```
3. Link your local directory to your new Firebase project:
   ```bash
   firebase use --add
   ```
   Select the project you created in Step 1 and alias it as `default`.

## 5. Upgrade to Blaze (required for Cloud Functions)

Cloud Functions (and Add Game) require the **Blaze (pay-as-you-go)** plan. You still get generous free tiers; a two-user tracker usually stays at **$0**.

1. Open [Firebase Console → Usage and billing](https://console.firebase.google.com/project/_/usage/details) (pick project **nen-tracker**).
2. Click **Modify plan** / **Upgrade** → **Blaze**.
3. Link a billing account (Google Cloud). Set a [budget alert](https://console.cloud.google.com/billing) (e.g. $5/month) if you want peace of mind.

You do **not** need `firebase functions:secrets:set` for this project — the Gemini key lives in `functions/.env` instead.

## 6. Cloud Functions (Phase 5 — Add Game)

Install function dependencies once:

```bash
cd functions
npm install
cd ..
```

### Allowed emails (functions runtime)

Copy `functions/.env.example` to `functions/.env`:

```env
GEMINI_API_KEY=AIza...   # from https://aistudio.google.com/apikey (free tier)
ALLOWED_EMAIL_0=you@gmail.com
ALLOWED_EMAIL_1=friend@gmail.com
```

Firebase loads `functions/.env` when you deploy. **Never commit `functions/.env` to git.**

### Deploy functions only (first test)

```bash
firebase deploy --only functions
```

After deploy, use **+ Add Game** in the app with a Steam URL. Cold start can take 15–30 seconds.

### Optional: local emulator

```bash
# Terminal 1
firebase emulators:start --only functions

# In .env.local set:
# VITE_USE_FUNCTIONS_EMULATOR=true
```

## 7. Building and Deploying

Whenever you are ready to publish the app to the live web:

1. Build the React frontend:
   ```bash
   npm run build
   ```
2. Deploy everything (Hosting rules, Firestore rules, and Cloud Functions):
   ```bash
   firebase deploy
   ```

> [!TIP]
> After deployment, Firebase will provide you with a live `web.app` URL where you and your friend can log in and use the tracker!
