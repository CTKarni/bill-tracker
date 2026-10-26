# Credit Card Expense Tracker: Implementation Plan

> This file is the single source of truth. Read all of it before writing any code.
> Build the phases **in order**. Do not skip ahead. Do not add features that are not in this file.

---

## 1. Project Goal

A personal credit card expense tracker. The user often cannot remember where the money went when the bill arrives. The app must make it easy to log spending, see the available limit at any time, and match spending to the billing cycle on the real bill.

- Single user, personal use.
- Local-first: all data stays in the browser. No backend, no login, no cloud.
- Works well on a phone and on a laptop (responsive, installable as a PWA).
- Currency: INR (₹). Format numbers with Indian digit grouping (example: ₹1,25,000.50).

---

## 2. Tech Stack (fixed, do not change)

| Part | Choice |
|---|---|
| Framework | React + Vite + TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database | Dexie.js (IndexedDB) |
| Routing | React Router |
| Charts | Recharts |
| CSV export | PapaParse |
| Excel export | SheetJS (`xlsx`) |
| PWA | `vite-plugin-pwa` |
| Tests | Vitest |
| Dates | `date-fns` |
| Icons | `lucide-react` |

---

## 3. Design Rules (Notion-inspired, minimal)

- Background: off-white (`#FBFBFA`). Text: near-black (`#37352F`). Muted text: `#787774`.
- Borders: 1px soft grey (`#E9E9E7`). Rounded corners: small (4 to 6px). No heavy shadows.
- One font: Inter. Clear size hierarchy. Plenty of white space.
- Layout: left sidebar (collapsible on mobile) + main content area.
- Main data view is a **clean table** (like a Notion database), with inline filters on top.
- Accent colors only for status: green (ok), amber (warning at 80%), red (over limit or overdue).
- On mobile: sidebar becomes a bottom tab bar or a hamburger menu. A floating "+" button opens Quick Add.
- Support light mode only (dark mode is out of scope).

---

## 4. Security and Privacy Rules (must follow)

- Store ONLY the card nickname and the last 4 digits.
- NEVER store or ask for the full card number, CVV, or expiry date.
- No analytics, no tracking, no external network calls for user data.

---

## 5. Data Model

**Store all money as integers in paise** (₹1 = 100 paise) to avoid floating point errors. Convert only for display and input.

```ts
type Card = {
  id: string;
  nickname: string;          // e.g. "HDFC Regalia"
  last4: string;             // exactly 4 digits
  limit: number;             // paise
  statementDay: number;      // 1 to 31
  dueDay: number;            // 1 to 31
  color?: string;
  createdAt: number;
};

type Category = {
  id: string;
  name: string;
  color: string;
  monthlyBudget?: number;    // paise, optional (budget per billing cycle)
  isDefault: boolean;
};

type TransactionType = 'expense' | 'payment' | 'refund';

type Transaction = {
  id: string;
  cardId: string;
  type: TransactionType;
  amount: number;            // paise, always positive
  categoryId?: string;       // required for expense and refund, not used for payment
  date: string;              // ISO date YYYY-MM-DD
  note?: string;
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'yearly';
  isReimbursable: boolean;
  reimbursableFrom?: string; // person name, optional
  isReimbursed: boolean;
  createdAt: number;
};

type Settings = {
  id: 'main';
  reminderDaysBeforeDue: number;   // default 3
  budgetAlertPercent: number;      // default 80
};
```

**Default categories (seed on first run):** Food and Dining, Groceries, Shopping, Travel, Fuel, Bills and Utilities, Entertainment, Subscriptions, Health, Education, Other.

---

## 6. Core Business Logic (`src/lib/finance.ts`)

Write these as **pure functions** (no database or UI inside). Every function must have Vitest tests in `src/lib/finance.test.ts`.

### 6.1 Outstanding and available limit

```
outstanding = sum(expenses) - sum(refunds) - sum(payments)     // for one card, all time
availableLimit = card.limit - outstanding
utilization = max(0, outstanding) / card.limit                  // 0 to 1+
```

- If the user overpays, `outstanding` becomes negative. Show it as a "credit balance". Do not crash.
- `utilization` above 100% is possible. Show it in red.

### 6.2 Billing cycle

- A cycle **ends on the statement date** and **starts the day after the previous statement date**.
- `getCycle(card, date)` returns `{ start, end, statementDate, dueDate }` for the cycle that contains `date`.
- A transaction dated exactly on the statement day belongs to the cycle that ends on that day.
- **Short months:** if `statementDay` or `dueDay` is larger than the days in that month, use the last day of that month (example: day 31 in February becomes Feb 28 or 29).
- **Due date:** the first occurrence of `dueDay` AFTER the statement date. (Example: statement 15th, due 5th gives the 5th of the next month. Statement 5th, due 25th gives the 25th of the same month.)
- Also provide: `getCycles(card, count)` for the last N cycles, and `daysLeftInCycle(card, today)`, `daysUntilDue(card, today)`.

### 6.3 Totals

- `cycleSpend(transactions, cycle)`: expenses minus refunds inside the cycle.
- `categoryTotals(transactions, cycle)`: spend per category in the cycle.
- `monthlyTotals(transactions, monthsBack)`: for month-over-month charts (calendar months).
- `budgetStatus(spent, budget, alertPercent)`: returns `'ok' | 'warning' | 'over'` plus the percent used.

### 6.4 Bill match check

- `billMatch(loggedCycleSpend, statementTotal)` returns the difference and a message: "You may have forgotten ₹X of spending" or "Matches" or "Logged more than the bill by ₹X".

### 6.5 Required test cases (minimum)

- Available limit with expenses only, with payments, with refunds, with overpayment.
- Cycle for a date before, on, and after the statement day.
- Statement day 31 in February (normal and leap year), and in 30-day months.
- Due date in the same month and in the next month.
- Year boundary (December to January).
- Budget status at 79%, 80%, 100%, 101%.

---

## 7. Phases

For each phase: build it, run the tests, run `npm run build`, fix errors, then give a short summary of what was done and what to check manually. **Commit after every phase** with a clear message.

### Phase 1: Setup and App Shell

- [ ] Create the Vite + React + TypeScript project. Install all packages from Section 2.
- [ ] Configure Tailwind with the design rules from Section 3. Add the Inter font.
- [ ] Folder structure:
  ```
  src/
    components/   (reusable UI)
    pages/        (one file per screen)
    db/           (Dexie setup and queries)
    lib/          (finance.ts, format.ts, dates.ts)
    hooks/
  ```
- [ ] Set up Dexie with the tables from Section 5 and seed the default categories and settings.
- [ ] Build the app shell: sidebar (Dashboard, Cards, Transactions, Budgets, Subscriptions, Charts, Settings) with React Router and empty placeholder pages.
- [ ] Add `lib/format.ts`: `formatINR(paise)` with Indian grouping, `parseINRInput(string)` to paise.
- [ ] Add a `README.md` with run instructions.

**Done when:** the app runs, the sidebar navigation works on desktop and mobile, and the database seeds correctly.

### Phase 2: Cards and Finance Logic

- [ ] Implement everything in Section 6 in `lib/finance.ts` with all required tests passing.
- [ ] Cards page: add, edit, delete cards (with a confirm dialog; deleting a card deletes its transactions).
- [ ] Form validation: last4 is 4 digits, limit above 0, statement day and due day between 1 and 31.
- [ ] Each card shows: nickname, last 4, limit, outstanding, **available limit**, utilization bar (green below 30%, amber 30 to 70%, red above 70%), next statement date, next due date.

**Done when:** all tests pass and a card shows correct numbers for the limit and dates.

### Phase 3: Transactions (MVP complete)

- [ ] **Quick Add** (floating "+" button and keyboard shortcut `N`): amount, card, category, date (default today), note. The amount field is focused first. Must be usable in under 5 seconds. Remember the last used card.
- [ ] Support three types: expense, payment (bill payment, no category), refund/cashback.
- [ ] Reimbursable option: checkbox, optional "from" name, and a "mark as reimbursed" action.
- [ ] Transactions page: table with date, type, category, card, note, amount. Edit and delete rows. Sort by date (newest first).
- [ ] Available limit and utilization update immediately after any change.
- [ ] Dashboard: for each card show available limit, utilization, current cycle spend, days left in cycle, and a "Pay by DD MMM" due-date countdown. Show a banner when the due date is within `reminderDaysBeforeDue` days.

**Done when:** a user can add an expense and a payment and see the available limit change correctly on the dashboard.

### Phase 4: Cycles, Search, Budgets, Recurring

- [ ] **Cycle view:** a selector on the Transactions page to choose a card and a cycle (current by default, with previous and next arrows). Show the cycle date range and total spend, matching what is on the bill.
- [ ] **Search and filters:** text search (note, category, amount), filters for card, category, type, date range, amount range, reimbursable. Filters combine. Show a result count and total.
- [ ] **Budgets page:** set a budget per category (per billing cycle). Show progress bars with status colors. Show an alert banner on the dashboard when a category reaches the alert percent (default 80%) or goes over.
- [ ] **Recurring and Subscriptions:** a recurring flag on transactions (monthly or yearly). The Subscriptions page lists recurring items with the next expected date and a total monthly cost. Include an "Add this month's charge" button that creates a new transaction from the template.
- [ ] **Bill match check:** on the cycle view, an input for the statement total, showing the difference using `billMatch`.
- [ ] **Reimbursable summary:** a small section showing the total still owed to the user, grouped by person.

**Done when:** filters and search work together, budget alerts appear at 80%, and the bill match check shows the right difference.

### Phase 5: Charts, Export, PWA, Reminders, Settings

- [ ] **Charts page** (Recharts): (1) category breakdown for the selected cycle (donut or bar); (2) month-over-month spend comparison (bar chart, last 6 months); (3) optional toggle to exclude reimbursable spending.
- [ ] **Export:** buttons to download CSV and Excel for all transactions or the current filter. Columns: date, card, type, category, amount (in ₹), note, recurring, reimbursable.
- [ ] **PWA:** manifest, icons, service worker, installable, works offline.
- [ ] **Reminders:** (1) in-app banners for due dates; (2) a button "Add due dates to calendar" that downloads an `.ics` file with due-date events and an alarm set to `reminderDaysBeforeDue` days before.
- [ ] **Settings page:** reminder days, budget alert percent, manage categories (add, rename, recolor, delete with reassign), full data backup (export JSON) and restore (import JSON), and "delete all data".
- [ ] Polish: empty states, loading states, error messages, keyboard accessibility, mobile layout check.

**Done when:** all features in this phase work, the app installs as a PWA, and exports open correctly in Excel.

### Phase 6 (Optional, only if everything above is stable): EMI Tracking

- [ ] Add an EMI record: total amount, number of months, monthly amount, start date, card.
- [ ] Show upcoming EMI charges per cycle and the remaining EMI amount in "committed spend" on the dashboard.

---

## 8. Quality Rules

- TypeScript strict mode. No `any` unless unavoidable (with a comment).
- Keep components small and reusable. Keep business logic out of components.
- Validate all form input. Never allow negative or zero amounts.
- Use `useLiveQuery` (dexie-react-hooks) so the UI updates automatically when data changes.
- All dates are handled in local time using ISO `YYYY-MM-DD` strings. Avoid timezone bugs.
- Run `npm run test` and `npm run build` after each phase. Both must pass before moving on.
- Write clear commit messages (example: `feat: add quick add transaction form`).

---

## 9. Out of Scope (do NOT build)

- Backend, user accounts, login, or cloud sync.
- Bank or SMS auto-import.
- Storing sensitive card data (full number, CVV, expiry).
- Dark mode, multiple currencies, multi-user features.

---

## 10. Final Deliverables

- A working app that runs with `npm install` and `npm run dev`.
- Passing tests (`npm run test`) and a clean production build (`npm run build`).
- `README.md` with: how to run, how to deploy to Vercel or Netlify, and a short feature list.
