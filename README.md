# Nen? Co-op Gaming Tracker

A lightweight, premium React SPA built with Vite and Firebase to track, rate, and filter co-op games for exactly two users.

## Project Structure
- **Frontend**: React + Vite
- **Styling**: Vanilla CSS (Aero Glassmorphism aesthetic)
- **Backend**: Firebase Auth, Firestore
- **Serverless/API**: Firebase Cloud Functions
- **Hosting**: Firebase Hosting

## Setup & Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to `.env.local` and populate the fields for local testing:
   ```env
   VITE_ALLOWED_EMAIL_0=your_email@gmail.com
   VITE_ALLOWED_EMAIL_1=friend_email@gmail.com
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

## Development Guidelines
- Read `docs/AGENT_TODO.md` (handoff & progress), `docs/manifest_of_understanding.md` (spec), and `docs/ai_rules.md` (constraints).
- No personal names or static emails should be hardcoded in the source code.
