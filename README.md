# Job Desk

A private portal for handing photos between you, your contractors, and your editing
suppliers — without either side seeing the other's identity.

- **You (Owner)**: see every job, upload raw photos, get notified when any job is done.
- **Contractors**: submit jobs and raw photos, see only their own jobs, never see supplier details.
- **Suppliers**: see only jobs assigned to them, upload edited photos, never see who
  submitted the job (owner vs. which contractor).

All of that separation is enforced in the server code (`lib/access.ts`), not just hidden
in the interface — so it holds even if someone inspects network requests.

---

## What this is built with (and what it costs)

| Piece | Service | Typical cost at small scale |
|---|---|---|
| App hosting | Vercel | Free tier is enough to start |
| Database | Neon (Postgres) | Free tier is enough to start |
| File storage | Cloudflare R2 | ~$0.015/GB/month stored, **no fee to download files** (this is the big saving vs. Dropbox/S3) |
| Email notifications | Resend | Free tier: 3,000 emails/month |

Realistically this runs for **$0–10/month** until you're at real volume, versus Dropbox
Business at $15–24 **per seat**.

---

## One-time setup (about 30–45 minutes)

You don't need to know how to code to do this — just follow each step.

### 1. Put the code on GitHub
1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new empty repository (e.g. `job-desk`).
3. Upload this whole project folder to it (GitHub's website lets you drag-and-drop files,
   or ask a developer friend to run `git push` for you — either works).

### 2. Create a database (Neon)
1. Go to [neon.com](https://neon.com) → sign up free → "Create a project."
2. Copy the **connection string** it gives you (starts with `postgresql://`).
3. Keep this tab open, you'll need it in step 4.

### 3. Create file storage (Cloudflare R2)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up free.
2. In the sidebar, go to **R2 Object Storage** → **Create bucket**. Name it e.g. `job-desk-files`.
   Keep it **private** (default) — files are only ever accessed through time-limited links
   the app generates, never a public URL.
3. Go to **R2 → Manage API Tokens → Create API Token**, give it read/write access to your bucket.
4. Note down: the **Account ID** (shown in the R2 dashboard), the **Access Key ID**, and
   **Secret Access Key** it gives you. Your endpoint URL is:
   `https://<Account ID>.r2.cloudflarestorage.com`

### 4. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → sign up free → **Add New Project** → import
   the GitHub repo you created in step 1.
2. Before clicking deploy, open **Environment Variables** and add everything from
   `.env.example` in this project, filled in with your real values:
   - `DATABASE_URL` → the Neon connection string from step 2
   - `AUTH_SECRET` → any random string (Vercel can generate one, or run
     `openssl rand -base64 32` on any computer)
   - `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` → from step 3
   - `RESEND_API_KEY`, `EMAIL_FROM` → from step 5 below (can add later)
   - `APP_URL` → your Vercel URL, e.g. `https://job-desk.vercel.app` (Vercel shows this
     after first deploy — you can add it after and redeploy)
3. Click **Deploy**.

### 5. Set up email notifications (Resend) — optional but recommended
1. Go to [resend.com](https://resend.com) → sign up free.
2. Verify a sending domain (or use their test domain to start).
3. Create an API key, add it as `RESEND_API_KEY` in Vercel's environment variables, and
   set `EMAIL_FROM` to an address on your verified domain.
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy) for the new variables to take effect.

### 6. Create the database tables
This project uses Prisma to manage the database. From your own computer (or ask a
developer to do this once):
```bash
npm install
npx prisma db push
```
This reads `prisma/schema.prisma` and creates the tables in your Neon database — it only
needs to be run once (and again if the schema ever changes).

### 7. Create your own login (the Owner account)
Set `OWNER_EMAIL`, `OWNER_PASSWORD`, and `OWNER_NAME` in your `.env` file (or Vercel
environment variables temporarily), then run:
```bash
npm run db:seed
```
This creates your Owner account. Log in at your Vercel URL with that email and password.
From there, use **Accounts** in the top nav to create logins for your suppliers and
contractors — you set their initial password and share it with them directly (e.g. by
phone or a private message, not email, for extra safety).

---

## Running it locally to make changes

```bash
npm install
cp .env.example .env   # fill in your real values
npx prisma db push
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## How the confidentiality rule actually works

Every job has a creator (you or a contractor) and an assigned supplier. All API routes
scope database queries through `lib/access.ts`'s `jobScopeFor()`:

- Owner → no restriction, sees all jobs.
- Contractor → only jobs where `createdById` is them.
- Supplier → only jobs where `supplierId` is them.

Then `serializeJobForViewer()` strips out identity fields depending on the viewer's role
before the API response is ever sent — a contractor's response never contains the
supplier's name or email, and a supplier's response never contains the contractor's name
or email. This isn't a UI-level hide; the data simply isn't in the response.

Files are never public. Every download goes through a signed, time-limited URL
(`lib/storage.ts`) generated only after the server checks the requester is allowed to see
that specific job.

---

## Extending it later
- **Bulk upload / drag-and-drop zones**: swap the plain `<input type="file">` in
  `components/FileUploader.tsx` for a drag-and-drop library.
- **Magic-link login instead of passwords**: swap the Credentials provider in `auth.ts`
  for NextAuth's Email provider (works well with Resend, which you'll already have set up).
- **Bigger galleries**: if suppliers need to preview images (not just download), R2
  supports public/CDN-backed buckets with a separate low-res preview flow — ask for this
  as a follow-up.
