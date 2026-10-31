# Forge Civic — Production Deployment Runbook & Security Checklist

This document outlines the end-to-end verification and deployment procedures for taking **Forge Civic** to production on Vercel and Supabase.

---

## 1. Environment Variable Matrix

Configure these variables in your local `.env.local` and in your **Vercel Project Settings → Environment Variables** (`Production`, `Preview`, `Development`).

| Variable Name | Required Scope | Sensitivity | Purpose / Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Public | Supabase project API gateway endpoint (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Public (Browser) | Supabase client publishable key used for client authentication & public reads. |
| `SUPABASE_URL` | Server Only | Public | Backend Supabase endpoint for route handlers. |
| `SUPABASE_SECRET_KEY` | Server Only | **Critical Secret** | Supabase service-role/secret key bypassing RLS for privileged admin functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | **Critical Secret** | Alias for `SUPABASE_SECRET_KEY` ensuring zero naming mismatches. |
| `GEMINI_API_KEY` | Server Only | **Critical Secret** | Google AI Studio API key used by `/api/verify` for Gemini 2.5 Flash Vision analysis. |
| `RESEND_API_KEY` | Server Only | **Critical Secret** | Resend email API key for municipal dispatch & critical hazard alerts. |
| `RESEND_FROM_EMAIL` | Server Only | Operational | Verified sending email domain (e.g., `alerts@forgecivic.org` or `onboarding@resend.dev`). |
| `DEFAULT_GOV_ALERT_EMAIL` | Server Only | Operational | Municipal authority inbox destination receiving automated severe hazard notifications. |

> [!CAUTION]
> Never expose `SUPABASE_SECRET_KEY` or `GEMINI_API_KEY` with the `NEXT_PUBLIC_` prefix. They must remain exclusively available to server-side Next.js route handlers.

---

## 2. Supabase Storage Policies (`potholes` Bucket)

Execute the following SQL in your **Supabase Dashboard → SQL Editor** to establish ironclad access rules:

```sql
-- 1. Ensure the bucket is created and set to public read
insert into storage.buckets (id, name, public)
values ('potholes', 'potholes', true)
on conflict (id) do update set public = true;

-- 2. Drop legacy or overly permissive policies
drop policy if exists "Public Read Pothole Photos" on storage.objects;
drop policy if exists "Authenticated Upload Pothole Photos" on storage.objects;

-- 3. Policy A: Public Read Access (Images displayable anywhere in app feed)
create policy "Public Read Pothole Photos"
  on storage.objects
  for select
  using (bucket_id = 'potholes');

-- 4. Policy B: Authenticated Upload Only with File Format & 10MB Limit
create policy "Authenticated Upload Pothole Photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'potholes'
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp'))
  );
```

---

## 3. Gemini Vision API Rate Limiting & Protection

Google Gemini 2.5 Flash powers the real-time hazard verification. Safeguard it in production with the following architecture:

1. **Server-Side Encapsulation**:
   - The Gemini API key is never exposed to the client. All calls originate strictly from `/api/verify` inside server-side Node.js.
2. **Session Gate Required**:
   - `/api/verify` immediately rejects unauthenticated calls with `401 Unauthorized` before the Gemini API is called, blocking unauthenticated scraping or brute-force requests.
3. **Google Cloud Console Hardening**:
   - In [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials), set **Application Restrictions** to IP restrictions (if using fixed egress) or restrict the key to **Generative Language API** only.
   - Set spending caps and quota alerts (e.g. 60 requests/minute alert threshold).
4. **Fallback Handling**:
   - If Gemini rate-limits (HTTP 429), `/api/verify` gracefully falls back to queuing the report for municipal manual review without crashing the submission flow.

---

## 4. Pre-Launch Production Verification Steps

Before flipping the production DNS:

- [ ] **Build Validation**:
  ```bash
  cd forge-app
  npm run build
  ```
  Verify the build exits with `code 0` with all routes compiled.

- [ ] **Authentication Smoke Test**:
  - Visit `/auth` and create a Citizen test account.
  - Verify that the citizen user cannot navigate to `/gov` (Next.js middleware redirects to `/?unauthorized=gov` with the security alert toast).
  - Sign in with an official account having `user_metadata.role = 'gov'`. Verify smooth access to `/gov`.

- [ ] **Citizen Reporting Flow**:
  - Tap `+ Snap Pothole`.
  - Capture or select a road surface image.
  - Verify location is acquired via GPS.
  - Confirm animated radar progression ("Locking GPS Coordinates..." → "Uploading High-Res Snapshot..." → "Gemini Vision Analyzing Asphalt Severity...").
  - Confirm report immediately renders at top of feed with severity badge and Google Maps link.

- [ ] **Municipal Dispatch Flow**:
  - Open `/gov` as a Gov Official.
  - Select an uninspected incident from the left column.
  - Verify the map coordinates embed loads.
  - Click `[Dispatch Repair Team]`. Verify status transitions to `In Progress` and an email notification is dispatched via Resend.
  - Click `[Mark as Repaired]`, enter an officer resolution note, and confirm.
  - Verify the status updates in real-time on the `/` Citizen Feed.

