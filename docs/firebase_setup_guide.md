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

## 5. Setting Production Environment Variables

For the frontend (React), Vite bakes your `.env.local` variables into the static HTML/JS files when you run `npm run build`. 
However, for our secure Cloud Functions (Steam Scraper & Gemini API in Phase 5), we must store secrets natively in Firebase.

Run these commands in your terminal to securely store your emails and API keys on Google's servers:

```bash
firebase functions:secrets:set ALLOWED_EMAIL_0
# (Type your user0 email and hit enter)

firebase functions:secrets:set ALLOWED_EMAIL_1
# (Type your user1 email and hit enter)

firebase functions:secrets:set GEMINI_API_KEY
# (Type your Gemini API key and hit enter)
```

## 6. Building and Deploying

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
