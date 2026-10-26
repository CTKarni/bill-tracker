# Credit Card Expense Tracker

A personal, minimal, local-first credit card expense tracker designed to match your real billing cycles and provide real-time visibility into available limits, statement cut-offs, and due dates.

Inspired by Notion's clean, distraction-free aesthetic.

---

## Features

- **Local-First & Private:** All data is stored locally in your browser using IndexedDB (via Dexie.js). No accounts, no backend, no cloud sync, and zero tracking.
- **Card Limits & Available Balance:** Automatically tracks outstanding balances across all cards and displays available limits in real time.
- **Accurate Billing Cycles:** Matches spending to actual statement cycles, handling short months, leap years, and statement-to-due date offsets.
- **INR Currency Support:** Formats currency in paise with standard Indian numbering (e.g. ₹1,25,000.50).
- **Responsive & PWA Ready:** Optimized for both mobile devices (with bottom tab bar navigation and quick actions) and desktop screens (with collapsible sidebar).
- **Quick Logging:** Rapid transaction logging with keyboard shortcuts (`N` for Quick Add).
- **Bill Match Check:** Cross-verify logged cycle expenses directly against your statement total.
- **Budgets & Subscriptions:** Category budgets with 80% threshold warnings and recurring charge tracking.

---

## Tech Stack

- **Framework:** React 19 + Vite + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (Notion-inspired minimalist theme)
- **Database:** Dexie.js (IndexedDB) + `dexie-react-hooks`
- **Routing:** React Router v7
- **Charts:** Recharts
- **Exporting:** PapaParse (CSV) & SheetJS `xlsx` (Excel)
- **PWA:** `vite-plugin-pwa`
- **Date Handling:** `date-fns`
- **Testing:** Vitest
- **Icons:** `lucide-react`

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested on v22.x)
- npm 9+

### Installation

```bash
# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Tests

```bash
# Run Vitest test suite
npm run test
```

### Building for Production

```bash
# Type-check and create production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Deployment

### Deploy to Vercel

1. Push your repository to GitHub.
2. In the Vercel Dashboard, click **New Project** and select this repository.
3. Keep default settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Click **Deploy**.

### Deploy to Netlify

1. Link your repository in Netlify.
2. Set the build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Click **Deploy Site**.

---

## Security & Privacy

- Stores **only** card nickname, last 4 digits, limit, and cycle days.
- Never asks for or stores full card numbers, CVVs, or expiration dates.
- Completely offline capable.
# bill-tracker
