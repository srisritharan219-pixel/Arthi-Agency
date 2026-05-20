# Cloud Database Setup

The live Netlify domain must use one central database. The app now blocks hosted localStorage fallback, so the live site will not create different employee, attendance, payroll, or report data on different computers.

## Netlify Built-In Cloud Sync

This project now includes a Netlify Function with Netlify Blobs storage. This is the quickest fix for the live Netlify domain because it does not require Supabase keys.

Deploy the full project from Git or Netlify CLI, not only the static HTML files. The deploy must include:

- `package.json`
- `package-lock.json`
- `netlify.toml`
- `netlify/functions/api.js`
- `cloud.config.js`
- `app.js`, `index.html`, `styles.css`

After redeploy, open:

```text
https://your-netlify-domain/.netlify/functions/api?action=load_state
```

It should return JSON with `"status":"success"`. Then the dashboard badge should show `Live Database Synced`.

## Optional: Netlify + Supabase

If you prefer Supabase instead of Netlify Blobs:

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase-schema.sql`.
3. In Netlify, open Site configuration > Environment variables and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy the full project folder, including:
   - `netlify.toml`
   - `netlify/functions/api.js`
   - `cloud.config.js`
   - `app.js`, `index.html`, `styles.css`
5. Open the live domain in two browsers. The sync badge must show `Live Database Synced`.

If Supabase variables are missing, the Netlify Function automatically uses Netlify Blobs as the central cloud database.

## Hostinger PHP + MySQL

If using Hostinger instead of Netlify functions:

1. Upload `api.php`, `db.php`, `schema.sql`, and `db.config.php` to the PHP hosting account.
2. Create MySQL database/user in Hostinger.
3. Copy `db.config.example.php` to `db.config.php` and set the database details.
4. Edit `cloud.config.js`:

```js
window.ATTENDFLOW_CONFIG = {
    API_URL: "https://your-domain.com/api.php",
    CLOUD_REQUIRED: true,
    ALLOW_LOCAL_FALLBACK: false
};
```

5. Deploy the frontend and confirm the badge shows `Live Database Synced`.

## Local Data Migration

When the central database is empty, the first browser that still has old local employee/attendance/payroll data will migrate it once into the cloud database, then clear the old local main data. After that, every computer/mobile reads the central database only.
