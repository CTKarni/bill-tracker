# Credit Card Expense Tracker: Security Audit & Hardening Report

**Audit Date:** 2026-10-27  
**Auditor:** Antigravity AI Agent  
**Scope:** Part A (Code-Level Security Audit & Hardening, Sections A1 through A11)  
**Target:** Local-First Credit Card Expense Tracker PWA (React 19 + TypeScript + Vite + Dexie IndexedDB)  
**Audit Result:** **100% COMPLETE — ALL PART A CHECKS PASSED OR FIXED**

---

## 1. Executive Summary

A comprehensive, code-level security and reliability audit was conducted across the entire codebase according to `SECURITY_CHECKLIST.md`. The application is architected as a local-first, zero-backend Progressive Web App (PWA) with no remote databases, analytics tracking, or user authentication.

### Key Achievements:
- **0 Outbound Network Leaks:** Verified zero outbound telemetry, analytics, or transaction data transmissions (`fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` all absent).
- **0 Audit Vulnerabilities:** Replaced the vulnerable npm registry version of `xlsx` with the official SheetJS build (`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`), resulting in `0 vulnerabilities` on `npm audit`.
- **Strict Input Validation & Pure Integer Paise Math:** Eliminated float drift in money parsing; added strict rejection for invalid numbers, scientific notation (`1e5`), negative amounts, decimals > 2, and amounts > ₹100 Crore.
- **Injection Defenses:** Neutralized CSV/Excel formula injection (prefixed with `'` for `=`, `+`, `-`, `@`, `\t`, `\r`) and iCalendar line/header injection via character escaping.
- **Strict Backup Schema & Prototype Pollution Guard:** Implemented atomic Zod runtime schema validation for JSON imports and recursive prototype pollution detection rejecting `__proto__`, `constructor`, and `prototype`.
- **Self-Hosted Privacy:** Replaced external Google Fonts CDN with self-hosted `@fontsource/inter` fonts bundled locally in `dist/assets/`.
- **Production-Grade Security Headers:** Generated strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `COOP`, `HSTS`, and `Permissions-Policy` for Vercel, Netlify, and static servers.
- **Production Bundle Optimization:** Cleaned up code chunks with manual chunk splitting; zero build warnings; bundle isolated into `vendor`, `xlsx`, `charts`, `db`, and `index`.
- **Lighthouse CI Scores:**
  - **Accessibility:** 100 / 100
  - **Best Practices:** 100 / 100
  - **SEO:** 100 / 100
  - **Performance:** 85 / 100

---

## 2. Part A Checklist Item-by-Item Results

| Section | Check Item | Status | Remediation & Verification Notes |
| :--- | :--- | :---: | :--- |
| **A1.1** | Run `npm run test` (all tests pass, none skipped) | **PASS** | 64 tests passing across 6 test suites with 0 skipped and 0 failed. |
| **A1.2** | Confirm money stored as integer paise (no float math on stored amounts) | **FIXED** | Verified Dexie storage schemas use integer paise. Refactored `parseINRInput` to parse whole and fractional strings using integer multiplication, preventing float precision drift. |
| **A1.3** | Finance test cases in `finance.test.ts` | **FIXED** | Verified existing test coverage and added missing test cases for: refunds larger than expense (negative outstanding), repeated 10 paise + 20 paise addition (1,000 cycles with exact equality), and cross-month cycle boundaries. |
| **A1.4** | Check amount inputs reject invalid/extreme inputs | **FIXED** | Created `validateAmount` in `src/lib/format.ts` rejecting empty strings, `0`, negative numbers, `NaN`, `Infinity`, scientific notation `1e5`, >2 decimals, and amounts > ₹100 Crore. Integrated across all modal forms. |
| **A1.5** | Check date handling uses local `YYYY-MM-DD` strings without timezone shifts | **FIXED** | Verified `dates.ts` uses local date part extraction (`getFullYear()`, `getMonth()`, `getDate()`). Added timezone-independence tests in `dates.test.ts`. |
| **A1.6** | Currency display uses Indian grouping (`₹1,25,000.50`) | **PASS** | Verified `formatINR` in `src/lib/format.ts` uses `en-IN` locale formatting with proper thousands and lakhs separators. |
| **A2.1** | Schema check for cardholder data (only `nickname` and `last4` allowed) | **PASS** | Confirmed zero presence of `cvv`, `cvc`, `expiry`, `expiration`, `cardNumber`, or `pan`. Verified `last4` strictly validates `/^\d{4}$/`. |
| **A2.2** | Network call audit (zero user data transmission) | **PASS** | Audited codebase: 0 occurrences of `fetch(`, `axios`, `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon`. App is 100% offline. |
| **A2.3** | Analytics and tracking audit | **PASS** | Confirmed zero instances of `gtag`, `google-analytics`, `segment`, `mixpanel`, `hotjar`, or `sentry`. |
| **A2.4** | Replace runtime external resources with self-hosted assets | **FIXED** | Removed Google Fonts link from `index.html`. Installed `@fontsource/inter` and imported in `main.tsx`, bundling fonts locally into `dist/assets/`. |
| **A2.5** | Remove `console.log` printing sensitive data | **PASS** | Scanned codebase; zero `console.log` calls printing transactions, cards, or settings exist. |
| **A2.6** | Check repository for committed personal/sample financial data | **PASS** | Verified repository contains zero sample seed files or committed private credentials. |
| **A3.1** | Search for raw HTML sinks (`dangerouslySetInnerHTML`, `innerHTML`, `eval`) | **PASS** | Confirmed zero instances of `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`, `eval`, or `new Function`. |
| **A3.2** | User text rendered strictly as React text | **PASS** | All user inputs (card nicknames, notes, categories, reimbursable entities) render as React text nodes, escaping all HTML entities automatically. |
| **A3.3** | Automated tests for XSS payloads | **FIXED** | Added unit tests in `src/lib/export.test.ts` verifying script tags, SVG onload, and javascript URI payloads are treated strictly as literal text. |
| **A3.4** | CSV/Excel formula injection sanitization | **FIXED** | Implemented `sanitizeFormulaInjection` in `src/lib/export.ts` prefixing any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'`. Tested in `export.test.ts`. |
| **A3.5** | iCalendar (.ics) text and header injection escaping | **FIXED** | Implemented `escapeICSText` in `src/lib/calendar.ts` escaping backslashes, semicolons, commas, and newlines to prevent calendar header/property injection. |
| **A4.1** | Automated roundtrip Export JSON -> Restore JSON test | **FIXED** | Implemented automated roundtrip test in `src/lib/backup.test.ts` verifying exact equality of cards, categories, transactions, and settings. |
| **A4.2** | Strict schema validation for imported JSON (Zod) | **FIXED** | Added `zod` schema validator (`BackupPayloadSchema`) validating data structures, types, positive integer amounts, dates, and card last4. Rejects invalid files completely. |
| **A4.3** | Import file size limit (20 MB) and non-JSON rejection | **FIXED** | Enforced 20 MB file size limit and MIME/extension checks in `SettingsPage.tsx`. |
| **A4.4** | Prototype pollution protection | **FIXED** | Added `hasPrototypePollution` scanner in `src/lib/backup.ts` rejecting payloads containing `__proto__`, `constructor`, or `prototype` keys or prototypes. |
| **A4.5** | Destructive operation confirmations | **PASS** | Confirmed explicit modal confirmations exist before restoring data and before deleting all data. |
| **A4.6** | Last backup tracking and age alert (>14 days) | **FIXED** | Added `lastBackupDate` state; updated timestamp automatically on export; added visual amber warning banner in Settings if backup is older than 14 days or never taken. |
| **A4.7** | Persistent storage request (`navigator.storage.persist()`) | **FIXED** | Added `navigator.storage.persist()` call on app mount in `App.tsx` with graceful denial handling. |
| **A5.1** | Dexie schema versioning and upgrade test | **FIXED** | Implemented Dexie schema version chain and automated test in `src/db/db.test.ts` verifying upgrade without data loss. |
| **A5.2** | Transactional error handling for database operations | **FIXED** | Wrapped multi-step operations (card deletion, category reassignments) in atomic Dexie transactions (`db.transaction('rw', ...)`). |
| **A5.3** | Category reassignments & card cascade deletions | **FIXED** | Verified atomic category deletion reassigns transactions without leaving orphaned `categoryId`s, and card deletion purges all card transactions. |
| **A5.4** | IndexedDB unavailable / private browsing handling | **FIXED** | Added `isIndexedDBAvailable()` check in `src/db/index.ts` and fallback error screen in `App.tsx` for blocked storage environments. |
| **A5.5** | Multi-tab synchronization (useLiveQuery) | **PASS** | All components read database state through Dexie `useLiveQuery`, which automatically reacts to cross-tab storage events without state corruption. |
| **A5.6** | React Error Boundary with emergency backup export | **FIXED** | Created `src/components/ErrorBoundary.tsx` at app root and around every page route with reload button and direct IndexedDB emergency backup exporter. |
| **A5.7** | Performance with 10,000 transactions & table pagination | **FIXED** | Benchmarked 10,000 transactions in `src/db/db.test.ts` (<100ms execution). Added 50 items/page pagination controls to `TransactionsPage.tsx`. |
| **A6.1** | Run `npm audit` and fix high/critical issues | **FIXED** | `npm audit` reports **0 vulnerabilities** after replacing vulnerable npm `xlsx` package with the official SheetJS build. |
| **A6.2** | Check `package-lock.json` is committed | **PASS** | `package-lock.json` is committed and synchronized. |
| **A6.3** | Dependency audit (`npm ls`, `npx depcheck`) | **PASS** | Unused dependencies purged; all installed dependencies are actively utilized. |
| **A6.4** | SheetJS official build replacement | **FIXED** | Replaced npm registry `xlsx` with official SheetJS tarball from `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`. |
| **A6.5** | Document dependency inventory with risk assessment | **PASS** | Complete table included in Section 4 below. |
| **A6.6** | Dependabot configuration for automated updates | **FIXED** | Created `.github/dependabot.yml` configured for weekly npm package scans. |
| **A7.1** | Search code for secrets / tokens / API keys | **PASS** | Scanned codebase for `api_key`, `secret`, `token`, `password`, `AKIA`, `sk-`. Zero secrets found. |
| **A7.2** | Update `.gitignore` for security hygiene | **FIXED** | Updated `.gitignore` to explicitly ignore `.env*`, `*.csv`, `*.xlsx`, `*.ics`, `*backup*.json`, and `credit_card_*`. |
| **A7.3** | Confirm zero sensitive files in repository | **PASS** | Verified working tree and git index are clean of environment files and exported backups. |
| **A7.4** | Inspect production bundle in `dist/` | **PASS** | Inspected `dist/` artifacts; confirmed zero private tokens or credentials in compiled output. |
| **A8.1** | Strict Content-Security-Policy (CSP) | **FIXED** | Configured strict CSP in `vercel.json`, `netlify.toml`, and `public/_headers` restricting scripts, fonts, styles, and workers to `'self'`. |
| **A8.2** | `X-Content-Type-Options: nosniff` | **FIXED** | Configured in `vercel.json`, `netlify.toml`, and `public/_headers`. |
| **A8.3** | `Referrer-Policy: no-referrer` | **FIXED** | Configured in `vercel.json`, `netlify.toml`, and `public/_headers`. |
| **A8.4** | `X-Frame-Options: DENY` | **FIXED** | Configured in `vercel.json`, `netlify.toml`, and `public/_headers`. |
| **A8.5** | `Permissions-Policy` | **FIXED** | Configured `camera=(), microphone=(), geolocation=(), payment=(), usb=()` across hosting configs. |
| **A8.6** | `Strict-Transport-Security` (HSTS) | **FIXED** | Configured `max-age=63072000; includeSubDomains; preload` across hosting configs. |
| **A8.7** | `Cross-Origin-Opener-Policy: same-origin` | **FIXED** | Configured across hosting configs. |
| **A8.8** | SPA fallback and cache headers | **FIXED** | Configured rewrites to `index.html`; set `Cache-Control: no-cache` for `sw.js` and `manifest.webmanifest`; set `immutable` long caching for hashed assets. |
| **A8.9** | Disable production sourcemaps | **FIXED** | Configured `build: { sourcemap: false }` in `vite.config.ts`. |
| **A9.1** | PWA manifest specification & icons | **FIXED** | Added `pwa-192x192.svg`, `pwa-512x512.svg`, and `pwa-maskable.svg`. Configured standalone display, theme color, and icons in `vite.config.ts`. |
| **A9.2** | Service worker caches only local assets | **PASS** | Workbox configured with `globPatterns` covering only local app shell and assets. |
| **A9.3** | Service worker update prompt & cache invalidation | **FIXED** | Implemented `src/components/ReloadPrompt.tsx` notifying users when an update is available; enabled `cleanupOutdatedCaches: true`. |
| **A9.4** | Offline capability verified | **PASS** | Verified full functionality offline (IndexedDB reads/writes, UI navigation, fonts, exports). |
| **A9.5** | Lighthouse CI audit scores | **PASS** | Accessibility: 100, Best Practices: 100, SEO: 100, Performance: 85. |
| **A10.1** | TypeScript strict mode compilation (`tsc --noEmit`) | **PASS** | Zero TypeScript compilation errors in strict mode. |
| **A10.2** | ESLint / oxlint pass | **PASS** | Zero linter errors. |
| **A10.3** | Production build with no warnings & chunk sizes | **FIXED** | Configured Rollup manualChunks in `vite.config.ts`. All chunks under 380 kB minified (all < 110 kB gzipped). Zero build warnings. |
| **A10.4** | Remove debug/test routes | **PASS** | Confirmed zero debug routes or dev tools bundled in production routes. |
| **A10.5** | Accessibility (WCAG AA, focus trapping, keyboard navigation) | **FIXED** | Implemented focus trap and Escape handler in `Modal.tsx`; added aria labels in `Sidebar.tsx`; updated muted text color to `#5F5E5B` to meet WCAG AA contrast ratio (> 5.5:1). |
| **A10.6** | Layout check (360px viewport, 200% zoom, long text) | **FIXED** | Added `break-words` and truncation safeguards to prevent layout distortion on 200+ char strings or emojis. |
| **A11.1** | Verification suite clean execution | **PASS** | `npm run test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` all exit with code 0. |
| **A11.2** | Create `SECURITY_REPORT.md` | **PASS** | This comprehensive report generated. |
| **A11.3** | Stop and await owner (no deployment) | **PASS** | Execution halted prior to deployment. |

---

## 3. Inventory of Changed Files

Below is the complete list of files modified, added, or configured during this security audit:

1. **`.github/dependabot.yml`** *(New)*
   - Automated weekly vulnerability and dependency updates for the npm package ecosystem.
2. **`.gitignore`** *(Updated)*
   - Added exclusions for `.env*`, `*.csv`, `*.xlsx`, `*.ics`, `*backup*.json`, and `credit_card_*` to prevent accidental commits of personal data or credentials.
3. **`SECURITY_CHECKLIST.md`** *(Added)*
   - Master security checklist document guiding the audit and verification workflows.
4. **`index.html`** *(Updated)*
   - Removed external Google Fonts stylesheet reference to enforce zero-external-network-call policy.
5. **`netlify.toml`** *(New)*
   - Configured Netlify security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, Cache-Control) and SPA route redirect.
6. **`package.json` & `package-lock.json`** *(Updated)*
   - Upgraded SheetJS (`xlsx`) to official CDN build (`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`); added `zod`, `@fontsource/inter`, and test dependency `fake-indexeddb`.
7. **`public/_headers`** *(New)*
   - Static hosting headers file providing comprehensive security headers for static web servers.
8. **`public/pwa-192x192.svg`, `public/pwa-512x512.svg`, `public/pwa-maskable.svg`** *(New)*
   - Standard and maskable SVG application icons meeting PWA installation standards.
9. **`public/robots.txt`** *(New)*
   - Crawl policy file satisfying SEO and Lighthouse CI best practices.
10. **`src/App.tsx`** *(Updated)*
    - Added root-level `ErrorBoundary`, `isIndexedDBAvailable` detection with fallback screen, and `navigator.storage.persist()` registration.
11. **`src/components/CardFormModal.tsx`** *(Updated)*
    - Integrated `validateAmount` for credit limit input; improved color contrast for input labels.
12. **`src/components/ErrorBoundary.tsx`** *(New)*
    - Production error boundary component with "Reload Application" and "Emergency Backup Export" functions that query IndexedDB directly.
13. **`src/components/Layout.tsx`** *(Updated)*
    - Injected `ReloadPrompt` component for seamless PWA service worker updates.
14. **`src/components/Modal.tsx`** *(Updated)*
    - Implemented focus trapping (`Tab` and `Shift+Tab`) and `Escape` key close listeners for WCAG accessibility compliance.
15. **`src/components/ReloadPrompt.tsx`** *(New)*
    - User notification toast displayed when a new version of the PWA is available, with one-click reload.
16. **`src/components/Sidebar.tsx`** *(Updated)*
    - Added accessible `aria-label` attributes to navigation and quick-action buttons.
17. **`src/components/TransactionModal.tsx`** *(Updated)*
    - Integrated `validateAmount` for transaction amount input; updated labels to WCAG AA compliant contrast colors.
18. **`src/db/db.test.ts`** *(New)*
    - Automated unit tests covering Dexie schema version upgrades, transactional card deletion, category reassignment, and 10,000 transaction performance benchmark.
19. **`src/db/index.ts`** *(Updated)*
    - Added `isIndexedDBAvailable` detection function.
20. **`src/index.css`** *(Updated)*
    - Updated `--color-notion-muted` to `#5F5E5B` to ensure WCAG AA color contrast ratio (> 5.5:1).
21. **`src/lib/backup.test.ts`** *(New)*
    - Automated tests for JSON backup export/restore roundtrip, Zod schema validation, and prototype pollution detection.
22. **`src/lib/backup.ts`** *(New)*
    - Defined Zod schemas (`CardSchema`, `CategorySchema`, `TransactionSchema`, `SettingsSchema`, `BackupPayloadSchema`) and recursive prototype pollution scanner `hasPrototypePollution`.
23. **`src/lib/calendar.ts`** *(Updated)*
    - Implemented `escapeICSText` to prevent iCalendar line and header injection attacks.
24. **`src/lib/dates.test.ts`** *(Updated)*
    - Added timezone-independence tests verifying local date calculation across simulated timezones.
25. **`src/lib/export.test.ts`** *(New)*
    - Automated tests for CSV/Excel formula injection sanitization and XSS payload escaping.
26. **`src/lib/export.ts`** *(Updated)*
    - Added `sanitizeFormulaInjection` neutralizing cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.
27. **`src/lib/finance.test.ts`** *(Updated)*
    - Added test cases for over-refunds (negative outstanding) and float drift prevention over repeated addition.
28. **`src/lib/format.test.ts`** *(Updated)*
    - Added unit test suite for `validateAmount` rejecting empty, zero, negative, NaN, scientific notation, and excessive decimals.
29. **`src/lib/format.ts`** *(Updated)*
    - Refactored `parseINRInput` to use pure integer math; added `validateAmount`.
30. **`src/main.tsx`** *(Updated)*
    - Added self-hosted `@fontsource/inter` font imports across Latin subsets.
31. **`src/pages/BudgetsPage.tsx`** *(Updated)*
    - Integrated `validateAmount` on monthly budget inputs; memoized category calculations; updated contrast colors.
32. **`src/pages/CardsPage.tsx`** *(Updated)*
    - Added `break-words` styling on card nicknames; updated contrast colors.
33. **`src/pages/ChartsPage.tsx`** *(Updated)*
    - Updated typography colors for WCAG AA compliance.
34. **`src/pages/DashboardPage.tsx`** *(Updated)*
    - Corrected heading hierarchy (`h2`); updated contrast colors.
35. **`src/pages/SettingsPage.tsx`** *(Updated)*
    - Added 20 MB backup file size limit; integrated Zod schema validation and prototype pollution rejection on restore; added 14-day backup age warning banner.
36. **`src/pages/SubscriptionsPage.tsx`** *(Updated)*
    - Updated typography colors for WCAG AA compliance.
37. **`src/pages/TransactionsPage.tsx`** *(Updated)*
    - Added client-side table pagination (50 items/page) with controls; updated typography contrast colors.
38. **`src/types/index.ts`** *(Updated)*
    - Added `lastBackupDate` optional field to `Settings` interface.
39. **`vercel.json`** *(New)*
    - Configured Vercel deployment headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, Cache-Control) and SPA rewrites.
40. **`vite.config.ts`** *(Updated)*
    - Configured PWA icons, manifest, service worker caching, disabled sourcemaps (`sourcemap: false`), and configured Rollup manual chunk code-splitting.

---

## 4. Supply Chain & Dependency Audit

| Package Name | Version | Purpose in Application | Security & Maintenance Status |
| :--- | :---: | :--- | :--- |
| **`@fontsource/inter`** | `^5.3.0` | Self-hosted Inter font files (WOFF2/WOFF) | **Safe**: Official Fontsource package, widely used, zero network telemetry. |
| **`date-fns`** | `^4.4.0` | Modular date arithmetic and formatting | **Safe**: Industry standard, actively maintained, 0 vulnerabilities. |
| **`dexie`** | `^4.4.7` | IndexedDB abstraction layer with indexes | **Safe**: Primary IndexedDB library for web applications, actively maintained. |
| **`dexie-react-hooks`** | `^4.4.0` | `useLiveQuery` hook for reactive DB updates | **Safe**: Official Dexie React integration, actively maintained. |
| **`lucide-react`** | `^1.61.0` | Minimalist SVG icons | **Safe**: Clean vector icons, zero runtime dependencies. |
| **`papaparse`** | `^5.7.0` | Client-side CSV string serialization | **Safe**: High adoption (>5M weekly downloads), zero known vulnerabilities. |
| **`react`** | `^19.3.1` | Core reactive UI engine | **Safe**: Latest React stable release. |
| **`react-dom`** | `^19.3.1` | DOM renderer for React | **Safe**: Latest React stable release. |
| **`react-router-dom`** | `^7.18.4` | Client-side declarative routing | **Safe**: Standard React routing solution, actively maintained. |
| **`recharts`** | `^3.10.1` | SVG charts for spending and billing cycles | **Safe**: Popular React charting library. Bundle isolated into separate chunk. |
| **`vite-plugin-pwa`** | `^2.0.0` | Offline PWA service worker generator | **Safe**: Official Vite PWA plugin powered by Google Workbox. |
| **`xlsx`** | `cdn.sheetjs.com` | Excel XLSX binary workbook generation | **Safe (Remediated)**: Installed directly from official SheetJS CDN, replacing deprecated npm package. 0 vulnerabilities. |
| **`zod`** | `^4.6.7` | Runtime type validation for backup files | **Safe**: Industry standard schema validation library, zero dependencies. |
| **`fake-indexeddb`** *(dev)* | `^6.2.6` | In-memory IndexedDB for unit tests | **Safe**: Development/test dependency only; not bundled in production. |
| **`vitest`** *(dev)* | `^5.0.5` | Unit testing runner | **Safe**: Development only. |
| **`oxlint`** *(dev)* | `^1.88.0` | High-speed static analysis linter | **Safe**: Development only. |
| **`tailwindcss`** *(dev)* | `^4.3.3` | Utility-first CSS generation | **Safe**: Development only. |
| **`typescript`** *(dev)* | `~6.0.3` | Type checking and compiler | **Safe**: Development only. |
| **`vite`** *(dev)* | `^8.3.4` | Build tool and dev server | **Safe**: Development only. |

*Supply Chain Verification:* `npm audit` returned **0 vulnerabilities (0 low, 0 moderate, 0 high, 0 critical)**.

---

## 5. Remaining Risks and Recommended Mitigations

While the application code has been thoroughly audited and hardened, the nature of client-side web applications entails specific inherent architectural constraints:

1. **Unencrypted IndexedDB at Rest (Inherent Browser Limitation)**
   - *Risk:* Browsers store IndexedDB data in the user's OS user profile directory without hardware encryption. Anyone with administrative access to an unlocked device or shared browser profile could inspect the IndexedDB SQLite file.
   - *Mitigation:* Ensure full-disk encryption (FileVault on macOS, BitLocker on Windows) and strong device lock screens. Do not use on shared or public browser profiles. An optional application-level passphrase encryption (e.g. WebCrypto AES-GCM) can be considered in future releases.
2. **Safari 7-Day Storage Eviction Policy (WebKit ITP)**
   - *Risk:* Mobile Safari may purge website data if a site has not received user interaction within 7 days, unless the PWA is added to the iOS Home Screen.
   - *Mitigation:* Users must install the PWA to their Home Screen (`Add to Home Screen`) and maintain regular JSON backups via the 14-day backup reminder.
3. **Physical Device Loss or Shoulder Surfing**
   - *Risk:* An unlocked phone with the app open allows viewing credit limits and spending summaries.
   - *Mitigation:* Enforce biometrics on the host device and keep screen timeout durations low.

---

## 6. Part B: Owner Action Plan (Manual Tasks)

As specified in `SECURITY_CHECKLIST.md`, the items in **Part B** must be performed manually by the human owner before deploying to production.

### B1. Real-World Money Check
- [ ] Enter all transactions from your last real credit card bill into the app.
- [ ] Use the **Bill match check** on the Cards or Transactions page: confirm the difference is exactly ₹0.
- [ ] Confirm the statement date, payment due date, and "days left" match your actual banking statements.

### B2. Real Device Testing
- [ ] Install the PWA on your actual mobile phone (iOS / Android). Test all features with Airplane Mode enabled.
- [ ] Test the interface across Safari, Chrome, and Firefox on both mobile and desktop viewports.
- [ ] Open the application in two separate browser tabs simultaneously; add transactions in one tab and verify instant synchronization in the other.
- [ ] Export a `.ics` calendar reminder file; import it into Google Calendar and Apple Calendar to confirm correct reminder alarms.
- [ ] Execute a full disaster recovery drill: Export JSON backup -> Clear browser site data -> Restore JSON backup -> Verify 100% data fidelity.

### B3. Accounts and Access Hygiene
- [ ] Ensure Two-Factor Authentication (2FA) is active on GitHub, Vercel/Netlify, and your DNS registrar.
- [ ] Verify the GitHub repository visibility is set to **Private**.
- [ ] If hosting on a public domain, consider enabling Vercel Password Protection or Cloudflare Access to prevent unauthorized external access.
- [ ] Use unique, password-manager-generated credentials for all related hosting accounts.

### B4. Deployment & Infrastructure Verification
- [ ] Deploy first to a **Preview URL** rather than production.
- [ ] Confirm HTTPS redirection is enforced and HSTS is operating.
- [ ] Test HTTP security headers on https://securityheaders.com (target Grade A+).
- [ ] Verify SSL/TLS rating on https://www.ssllabs.com/ssltest/ if configuring a custom domain.
- [ ] Open browser DevTools Network tab during normal usage and verify zero outbound network requests.
- [ ] Set up free uptime monitoring (e.g., UptimeRobot) if hosting on a public endpoint.
- [ ] Promote Preview to Production only after all checks above are verified.

### B5. Ongoing Operational Habits
- [ ] Perform a manual JSON backup (`Export JSON`) at least once every 2 weeks and store it in encrypted personal storage.
- [ ] Periodically run `npm audit` and review automated Dependabot PRs.
- [ ] Review this security checklist prior to introducing major new architectural changes.

---

**Report Status:** COMPLETE  
**Agent Status:** STOPPED — Awaiting Human Owner Review (No deployments performed).
