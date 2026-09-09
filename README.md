# DataTracker

Base Svelte 5 + Vite + Supabase project.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS / Linux**

   ```bash
   cp .env.example .env
   ```

3. In Supabase, open the DataTracker project and get the Project URL and publishable key from the Connect / API settings.

4. Put those values in `.env`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## Commands

```bash
npm run dev
npm run build
npm run preview
```

## Current structure

```text
DataTracker/
├─ src/
│  ├─ lib/
│  │  └─ supabase.js
│  ├─ App.svelte
│  ├─ app.css
│  └─ main.js
├─ .env.example
├─ .gitignore
├─ index.html
├─ package.json
├─ README.md
└─ vite.config.js
```

No application-specific database schema, tables, authentication rules, or business logic are included yet.

## Security

Only use a Supabase publishable/browser-safe key in the Vite frontend. Never put a Supabase `service_role` key in this repository's browser code or Vite environment variables.
