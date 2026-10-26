# Credit Card Expense Tracker: Security and Production-Readiness Checklist

> Read this whole file first. It describes a **local-first PWA** (React + Vite + TypeScript + Dexie/IndexedDB, no backend, no login).
> Part A is for the AI agent: audit the code, fix what you can, and report. Part B is for the human owner and must be done manually.
> Do not add new features. Only fix security, stability, and quality problems.

---

## How the Agent Must Work

1. Go through every item in **Part A**, in order.
2. For each item, mark the result: `PASS`, `FIXED`, `FAIL (needs owner)`, or `N/A`.
3. Fix problems directly in the code when the fix is safe and small. Run `npm run test` and `npm run build` after every group of fixes.
4. Do not change the finance logic in `src/lib/finance.ts` unless a test proves a bug. If you change it, add a test that fails before and passes after.
5. Commit after each section with a clear message (example: `fix: sanitize CSV export against formula injection`).
6. At the end, create `SECURITY_REPORT.md` containing: a table of all items with their result, a list of every file changed, a list of remaining risks, and a list of items the owner must do manually (Part B).

---

# PART A: Agent Tasks (code-level)

## A1. Money Logic and Data Integrity

- [ ] Run `npm run test`. All tests must pass with no skipped tests.
- [ ] Confirm all money is stored as **integer paise**. Search for any `parseFloat`, `toFixed`, or float math applied to stored amounts and fix it.
- [ ] Confirm these test cases exist in `finance.test.ts`; add any that are missing:
  - [ ] Available limit: expenses only, with payments, with refunds, with overpayment (negative outstanding)
  - [ ] Utilization above 100%
  - [ ] Refund larger than the original expense
  - [ ] Cycle for a date before, on, and after the statement day
  - [ ] Statement day 31 in February (normal year and leap year) and in 30-day months
  - [ ] Due date in the same month and in the next month
  - [ ] December to January year boundary
  - [ ] Budget status at 79%, 80%, 100%, 101%
  - [ ] Adding 10 paise + 20 paise repeatedly gives an exact total (no float drift)
- [ ] Check all amount inputs reject: empty, `0`, negative, `NaN`, `Infinity`, `1e5`, more than 2 decimals, and extremely large values (set a sensible maximum). Add validation where missing.
- [ ] Check that date handling uses local `YYYY-MM-DD` strings and has no timezone bug (a date must never shift by one day). Add a test that runs with a different `TZ` value if possible.
- [ ] Confirm every currency display uses Indian grouping (₹1,25,000.50).

## A2. Privacy and Sensitive Data

- [ ] Search the whole codebase and the database schema for: `cvv`, `cvc`, `expiry`, `expiration`, `cardNumber`, `pan`. Only `nickname` and `last4` may exist. Confirm `last4` accepts exactly 4 digits.
- [ ] Search for any network calls: `fetch(`, `axios`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon`. The app must **not send user data anywhere**. List every network call found and explain why it exists.
- [ ] Search for analytics or tracking: `gtag`, `google-analytics`, `segment`, `mixpanel`, `hotjar`, `sentry` (error tracking is allowed only if it never sends transaction data). Remove anything that is not needed.
- [ ] Find external resources loaded at runtime (Google Fonts, CDN scripts, external images). Replace with **self-hosted** versions (for example, self-host the Inter font).
- [ ] Remove all `console.log` calls that print transactions, cards, or settings.
- [ ] Check that no real or sample personal data is committed in the repo (JSON backups, seed files with real names or amounts).

## A3. XSS and Injection

- [ ] Search for `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(`. Remove or justify each one.
- [ ] Check that all user text (notes, category names, card nicknames, "reimbursable from" names) is rendered only as React text, never as HTML.
- [ ] Add a test or script that saves these payloads in every text field and confirms they display as plain text and run nothing:
  - `<script>alert(1)</script>`
  - `<img src=x onerror=alert(1)>`
  - `"><svg onload=alert(1)>`
  - `javascript:alert(1)`
- [ ] **CSV/Excel formula injection:** in the export code, any text cell starting with `=`, `+`, `-`, `@`, tab, or carriage return must be prefixed with a single quote `'` (or otherwise neutralized). This applies to CSV and Excel exports. Add tests for this.
- [ ] **.ics export:** escape commas, semicolons, backslashes, and new lines in text fields as required by the iCalendar format, and make sure card names cannot inject extra calendar lines.

## A4. Backup, Restore, and Import Safety

- [ ] Test **Export JSON then Restore JSON** with an automated test: the data after restore must equal the data before.
- [ ] Validate imported JSON strictly (use a schema validator such as `zod`): correct fields, correct types, valid dates, positive integer amounts, valid `last4`, known transaction types. Reject the whole file with a clear message if invalid. Never partially import.
- [ ] Limit the import file size (example: 20 MB) and reject non-JSON files.
- [ ] Protect against prototype pollution: reject keys named `__proto__`, `constructor`, `prototype` in imported data.
- [ ] Show a confirmation before restore ("this replaces all current data") and before "Delete all data".
- [ ] Add a "Last backup" date in Settings and a visible reminder when the last backup is older than 14 days.
- [ ] Call `navigator.storage.persist()` on first run (and handle denial gracefully) so the browser is less likely to delete the data.

## A5. Database and Stability

- [ ] Check the Dexie schema versioning. There must be a proper `version(n).stores(...)` chain with an `upgrade` function when needed. Add a test or script that opens an older-version database and upgrades it without data loss.
- [ ] Wrap database operations in error handling. A failed write must show a clear error and never leave half-saved data (use Dexie transactions for multi-step writes, such as deleting a card and its transactions).
- [ ] Check that deleting a category reassigns its transactions (no orphaned `categoryId`), and deleting a card removes its transactions in one transaction.
- [ ] Handle the case where IndexedDB is unavailable (private mode, blocked storage): show a clear message instead of a blank screen.
- [ ] Test two browser tabs open at once: data must stay in sync (use `useLiveQuery`) and not corrupt.
- [ ] Add a React **Error Boundary** at the app root and around each page, with a "Reload" button and a link to export a backup.
- [ ] Performance test: write a script that seeds 10,000 transactions, then check that the transactions table, search, filters, and charts stay responsive. Use pagination or virtualization if the table is slow.

## A6. Dependencies and Supply Chain

- [ ] Run `npm audit`. Fix all `high` and `critical` issues. Report any that cannot be fixed, with the reason.
- [ ] Check that `package-lock.json` is committed.
- [ ] Run `npm ls` and `npx depcheck`. Remove unused packages.
- [ ] **SheetJS (`xlsx`):** the version on the npm registry is outdated and has known vulnerabilities. Replace it with the official SheetJS build (installed from `https://cdn.sheetjs.com`) or switch to `exceljs`. The app only creates files and must never parse untrusted spreadsheets.
- [ ] List each dependency with its version and purpose in `SECURITY_REPORT.md`. Flag any package that is unmaintained, very new, or has very few downloads.
- [ ] Add `.github/dependabot.yml` for weekly npm updates.

## A7. Secrets and Repository Hygiene

- [ ] Search the code for secrets: API keys, tokens, passwords, private URLs. If `gitleaks` is available, run `gitleaks detect`; otherwise search with patterns (`api_key`, `secret`, `token`, `password`, `AKIA`, `sk-`).
- [ ] Confirm `.gitignore` includes `.env*`, `node_modules`, `dist`, and any backup or export files.
- [ ] Confirm there are no `.env` files, backup JSON files, or exported CSV/XLSX files in the repo.
- [ ] Remember: anything in frontend code is public. Make sure nothing private is bundled into the build (search the `dist` folder for suspicious strings).

## A8. Security Headers and Hosting Config

Create the hosting config for **Vercel** (`vercel.json`) and **Netlify** (`netlify.toml` or `_headers`), so it works on either:

- [ ] `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`. Test the app with this policy and fix anything that breaks (do not weaken it unless required, and explain every exception).
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: no-referrer`
- [ ] `X-Frame-Options: DENY`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (only after HTTPS is confirmed on the real domain)
- [ ] `Cross-Origin-Opener-Policy: same-origin`
- [ ] SPA fallback: all routes rewrite to `index.html`. The service worker file (`sw.js`) and `manifest.webmanifest` must not be cached forever (`Cache-Control: no-cache` for these two). Hashed asset files may use long cache (`immutable`).
- [ ] Disable production source maps in the Vite build config (`build.sourcemap: false`).

## A9. PWA and Offline

- [ ] Confirm the manifest has: name, short_name, start_url, display `standalone`, theme_color, background_color, and icons of 192 and 512 (including a maskable icon).
- [ ] Confirm the service worker only caches the app shell and static assets. It must never cache anything from other origins.
- [ ] Confirm there is an update flow: when a new version is deployed, the user sees "New version available, reload", and the old cache gets cleaned up (no stuck old version).
- [ ] Confirm the app works fully offline after the first load (build, serve with `vite preview`, go offline in DevTools or simulate it).
- [ ] Run Lighthouse in CI mode if possible (`npx lighthouse http://localhost:4173 --output=json`). Target 90+ for Performance, Accessibility, Best Practices, and SEO, and a passing PWA check. Report the scores.

## A10. Code Quality and Accessibility

- [ ] `npx tsc --noEmit` shows zero errors. TypeScript strict mode is on.
- [ ] ESLint passes (add a basic config if missing, including `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`).
- [ ] `npm run build` succeeds with no warnings. Check the bundle size and report the largest chunks.
- [ ] Remove debug pages, test routes, and dev-only code from the production build.
- [ ] Accessibility: all inputs have labels, all buttons have accessible names, focus is visible, dialogs trap focus and close with `Esc`, color contrast meets WCAG AA, and the app is fully usable with only the keyboard.
- [ ] Layout check at 360px width and at 200% zoom. Long text (200+ characters) in notes and nicknames and emojis must not break the layout.

## A11. Final Agent Output

- [ ] `npm run test`, `npm run build`, `npx tsc --noEmit`, and lint all pass.
- [ ] Create `SECURITY_REPORT.md` as described at the top of this file.
- [ ] Do not deploy. Stop and wait for the owner.

---

# PART B: Owner Tasks (manual, cannot be done by the agent)

## B1. Real-World Money Check

- [ ] Enter all transactions from your last real credit card bill. Use the **Bill match check**: the difference must be ₹0.
- [ ] Confirm the statement date, due date, and "days left" match your real card.

## B2. Real Device Testing

- [ ] Install the PWA on your real phone and test everything offline in airplane mode.
- [ ] Test on Chrome, Safari, and Firefox. Test on a small phone and a laptop.
- [ ] Open the app in two tabs at once and add data in both.
- [ ] Import the `.ics` file into Google Calendar or Apple Calendar and check the reminder time.
- [ ] Do a real backup and restore test: export JSON, clear the site data in the browser, restore, and check everything.
- [ ] iOS note: Safari may delete website data if the site is not used for a long time and not installed to the home screen. Install the app and keep regular backups.

## B3. Accounts and Access

- [ ] Turn on 2FA for GitHub, Vercel/Netlify, and your domain registrar.
- [ ] Make the GitHub repository **private**.
- [ ] Consider access protection (Vercel password protection or Cloudflare Access) so strangers cannot open your tool.
- [ ] Use a strong, unique password for each account (use a password manager).

## B4. Deployment

- [ ] Deploy first to a **preview URL**. Run the key checks there, not only on localhost.
- [ ] Check HTTPS works, and HTTP redirects to HTTPS. Then enable HSTS.
- [ ] Test headers at https://securityheaders.com (target A or higher) and https://observatory.mozilla.org.
- [ ] Check TLS at https://www.ssllabs.com/ssltest/ if you use a custom domain.
- [ ] Run an OWASP ZAP baseline scan on the preview URL (`zap-baseline.py -t https://your-url`).
- [ ] Open DevTools, go to the Network tab, and use the app. Confirm there are no requests that send your data.
- [ ] Keep the previous deployment so you can roll back with one click.
- [ ] Set up free uptime monitoring (UptimeRobot) if the app is public.
- [ ] Promote the preview to production only when all items above are done.

## B5. Ongoing Habits

- [ ] Back up your data (Export JSON) every 2 weeks and store the file safely (not in a public place).
- [ ] Update dependencies monthly (`npm audit`, then review Dependabot pull requests).
- [ ] Review this checklist again after any big change.

---

## Known Risk to Accept or Fix

IndexedDB data is **not encrypted**. Anyone with access to your unlocked device or browser profile can read it. Mitigations: use a phone and laptop screen lock, use full-disk encryption, and optionally add an app PIN lock in a future version.
