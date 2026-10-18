# Nightly backups

The Supabase Free plan does not keep backups. Every night at **01:30 Lagos time** GitHub makes an
**encrypted** copy of the database and keeps it for **30 days**. If something goes badly wrong
(data deleted by mistake, a project problem), the estate can be put back as it was that night.

What is in each backup:
- everything the app stores: residents, codes, gate log, staff, incidents, history, and so on
  (staff and incident photos are included, because they are stored in the database);
- the sign-in accounts, so everyone's PIN still works after a restore.

Not included: Fix-It photos (kept in Supabase Storage). Losing them would not stop the app working.

---

## One-time set-up (about 10 minutes)

Never paste the database password or the passphrase into a chat. Type them only into Supabase and GitHub.

### 1. Copy the database connection string from Supabase
1. Open your Supabase project and click **Connect** (top of the page).
2. Choose **Session pooler**. (The "Direct connection" does not work from GitHub.)
3. Copy the string. It looks like
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-xx.pooler.supabase.com:5432/postgres`
4. Replace `[YOUR-PASSWORD]` with the database password. If you don't know it, reset it under
   **Project Settings → Database → Reset database password**. Then update anything else that uses it.

### 2. Choose a backup passphrase
- At least 20 characters, for example four random words and a number.
- Write it down and keep it **somewhere safe offline**, such as a sealed envelope with the estate
  treasurer. **Without it, the backups cannot be opened by anyone, including you.**

### 3. Add both as GitHub secrets
1. On GitHub, open the repository → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name `SUPABASE_DB_URL` and paste the connection string from step 1.
3. Name `BACKUP_PASSPHRASE` and paste the passphrase from step 2.

### 4. Test it once
1. Go to **Actions → Nightly database backup → Run workflow**.
2. After 2–3 minutes it should show a green tick. Open the run: under **Artifacts** you will see
   `light-house-estate-backup-<date>`.
3. If it fails, GitHub emails the repository owner. A red cross on "Check the secrets are set"
   means a secret is missing.

Notes:
- GitHub runs scheduled jobs only from the **main** branch.
- On a public repository, GitHub pauses scheduled jobs after 60 days with no new commits. If that
  happens it emails the owner; click **Enable workflow** under Actions.

---

## Restoring (for a technical helper)

Only do this if data has really been lost. It replaces the current data with the backup's.

```bash
# 1. Download the artifact from GitHub (a .zip containing the .gpg file) and unzip it.
gpg --decrypt light-house-estate-YYYY-MM-DD.tar.gz.gpg > backup.tar.gz   # asks for the passphrase
tar -xzf backup.tar.gz                                                    # gives app.dump and auth.dump

# 2. Same Supabase project: restore the app data only (sign-in accounts are still there).
#    Session pooler connection string, PostgreSQL 17 tools.
pg_restore --dbname "$DB_URL" --no-owner --no-privileges --clean --if-exists app.dump
```

To restore into a **new** Supabase project instead: run the SQL files in `supabase/sql/` in order
first, then restore `auth.dump` and after it `app.dump`, both with
`pg_restore --data-only --disable-triggers --no-owner`, then deploy the edge functions
and set the same `PIN_PEPPER` secret as before (otherwise PINs will not work).

Practise a restore into a spare project once a year, so you know it works.
