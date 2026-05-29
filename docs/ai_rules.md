# AI Development Rules & Constraints: Nen? Co-op Gaming Tracker

This document outlines the strict rules and constraints that any AI coding assistant must follow when working on the "Nen?" project. It acts as an extension to the `manifest_of_understanding.md`.

## 1. Core Constraints & Simplicity

- **Keep it Simple:** This is a small web app for exactly two users. Do not over-engineer solutions. Do not introduce enterprise-grade complexity, heavy state management libraries (like Redux), or complex backend architectures unless absolutely necessary.
- **Strict Anti-Hardcoding:** Do not hardcode "Me" or "Friend", or static email addresses into the UI or logic. Always use dynamic resolution for `User 0` and `User 1` based on the configured `ALLOWED_EMAILS`.
- **Backend Simplicity:** Rely entirely on Firebase Auth and Firestore. Minimize the use of Cloud Functions unless dealing with CORS/Security issues that cannot be handled securely on the client.

## 2. Technology Stack Enforcement

- **React & Vite:** The project uses React bootstrapped with Vite. Do not introduce other frameworks like Next.js.
- **Styling:** Use Vanilla CSS or Tailwind CSS (as decided by the user). Emphasize Aero Glassmorphism, deep dark modes, and neon accents. Do not use generic component libraries (like MUI or Bootstrap) unless specifically instructed; custom styling is preferred for a premium feel.
- **Hosting:** Firebase Hosting is the only target.

## 3. Database Interactions

- **Schema Strictness:** Adhere exactly to the Firestore schema defined in `manifest_of_understanding.md`.
- **Security First:** Never bypass the Firestore Security Rules in client code. Ensure all queries filter based on the active user's permissions where applicable.

## 4. Feature-Specific Rules

- **Match Score Formula:** Do not alter the Match Score formula without explicit user permission. The Gemini "Russian Developer" vetting override (`ruDeveloperAlert === true` -> Score = 0%) is non-negotiable.
- **API integrations:** Always handle Steam API and Gemini API failures gracefully. Provide clear UI feedback if scraping fails or the API limit is reached.

## 5. Development Workflow

- **No assumptions:** If a requirement is ambiguous, stop and ask the user.
- **Component-Driven:** Keep React components small, focused, and reusable.
- **Premium UI:** Always prioritize a "Wow" factor. Add subtle hover states, smooth transitions, and polished layouts to every new component.
