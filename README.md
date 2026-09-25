# Personal Expense Tracker

> A practical, privacy-focused MERN application for understanding where money comes from, where it goes, and how everyday financial decisions shape the future.

Personal Expense Tracker is a full-stack BTech 3rd-year Computer Science project built with JavaScript. It provides a clear financial workspace for recording expenses and income, managing accounts, setting budgets and savings goals, scheduling recurring transactions, reviewing reports, and exporting personal records.

The project is intentionally practical and understandable. It uses real database records, authenticated API requests, atomic balance updates, ownership checks, and validation throughout the application.

## Why This Project Matters

Managing money is not only about adding numbers. A useful expense tracker should answer meaningful questions:

- How much did I spend this month?
- Which categories consume the most money?
- How much income reached each account?
- What is my real net cash flow?
- Which recurring payments are approaching?
- Am I moving toward my savings goals?
- Can I safely review or export my own financial history?

This application brings those answers into one focused dashboard while keeping the underlying logic visible and suitable for academic learning.

## Features

### Authentication and Security

- JWT authentication with HTTP-only cookies
- Password hashing with bcrypt
- Password change with current-password verification
- Session revocation after logout or password change
- Protected backend routes
- User ownership checks on financial records
- Request validation and rate limiting
- Secure account deletion with explicit confirmation

### Expenses

- Create, edit, view, and delete expenses
- Amount, description, category, date, payment method, account, merchant, tags, notes, and receipt
- JPEG, PNG, and WebP receipt validation
- Private receipt access for the owner only
- Search, category filtering, payment filtering, date filtering, sorting, and pagination
- Idempotency protection for duplicate submissions

### Income

- Record salary, pocket money, scholarships, freelance income, gifts, interest, and other income
- Assign income to a destination account
- Edit and delete income records
- Correct account balance updates

### Financial Accounts

- Cash, bank accounts, UPI wallets, savings accounts, and other account types
- Opening and current balances
- Account editing and deliberate archiving
- Historical transactions remain preserved after archiving
- Warnings for balances or active recurring rules before archiving

### Transfers and Reconciliation

- Transfer money between a user's own accounts
- Insufficient-funds and same-account protection
- Transfers excluded from income and expense reports
- Atomic balance updates using MongoDB transactions
- Statement-balance reconciliation
- Deliberate, auditable balance adjustments

### Budgets and Notifications

- Monthly budgets
- Spending thresholds at 50%, 80%, and 100%
- In-app notification center
- Read, unread, dismiss, and mark-all-read actions
- Duplicate alert prevention per budget period
- Recurring transaction due-date notifications

### Recurring Transactions

- Expense and income rules
- Daily, weekly, monthly, and yearly schedules
- Active, paused, and cancelled states
- Upcoming transaction display
- Server-side scheduler
- Missed-schedule handling
- Unique occurrence keys to prevent duplicate generation
- Generated transaction history

### Savings Goals

- Target amount and optional target date
- Contributions, withdrawals, and corrections
- Progress percentage and remaining amount
- Active, completed, and archived goals
- Savings tracking kept separate from expense totals

### Reports and Data Management

- Date-range financial reports
- Income, expenses, net cash flow, categories, monthly totals, largest expenses, and transaction count
- Account and category filtering
- CSV export for all or filtered transactions
- Formula-injection protection in exported CSV data
- Documented JSON personal-data backup
- No database IDs or sensitive internals in exports

### Settings and Preferences

- Display-name update
- Secure password update
- INR as the default currency
- Date-format preference
- Preferred dashboard month
- Notification preferences
- Light, dark, and system theme preference
- Custom expense and income categories
- Category rename and archive support without breaking historical transactions
- Permanent account deletion with receipt cleanup

## Technology Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Axios
- Recharts
- React Router

### Backend

- Node.js
- Express
- MongoDB
- Mongoose
- JWT
- bcrypt
- express-rate-limit
- Helmet
- Multer for receipt uploads

### Language

- JavaScript throughout the frontend and backend

## Project Structure

```text
expense-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── utils/
│   ├── package.json
│   └── server.js
├── .gitignore
└── README.md
```

## Requirements

- Node.js 20 or newer recommended
- npm
- MongoDB Atlas or a local MongoDB replica set
- A modern browser

MongoDB transactions are used for balance-changing operations. MongoDB Atlas supports transactions by default. A standalone local MongoDB server must be configured as a replica set before transfer, income, expense, and other atomic balance workflows can be fully exercised.

## Environment Variables

Create `backend/.env` from `backend/.env.example`:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/expense_tracker
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173
```

Create `frontend/.env` from `frontend/.env.example` when the API is not running at the default URL:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Never commit real `.env` files, database credentials, JWT secrets, or cloud-storage credentials.

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

## Running Locally

Open two terminals from the project root.

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

The API runs at:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

Open the application at:

```text
http://localhost:5173
```

For a production frontend build:

```bash
cd frontend
npm run build
npm run preview
```

For a production backend process:

```bash
cd backend
npm start
```

## Testing and Verification

Backend unit tests:

```bash
cd backend
npm test
```

Frontend lint and build:

```bash
cd frontend
npm run lint
npm run build
```

Live phase smoke tests:

```bash
cd backend
node scripts/phase11Smoke.js
node scripts/phase12Smoke.js
node scripts/phase13Smoke.js
node scripts/phase14Smoke.js
node scripts/phase15Smoke.js
node scripts/phase16Smoke.js
node scripts/phase17Smoke.js
node scripts/phase18Smoke.js
```

The smoke tests cover income, accounts, recurring transactions, receipts, notifications, exports, savings goals, transfers, reconciliation, settings, authorization, and account deletion. They create temporary test users and clean up their database records after execution.

## Financial Integrity Rules

The application follows these accounting rules:

1. Income increases its destination account balance.
2. Expenses decrease their selected account balance.
3. Transfers update two accounts but are never income or expenses.
4. Savings contributions do not automatically become expenses.
5. Editing and deleting transactions reverse and reapply balance effects correctly.
6. Recurring occurrences use unique identifiers to prevent duplicate processing.
7. Archived accounts retain historical records.
8. Every financial query is scoped to the authenticated user.

## Receipt Storage

Receipt images are stored outside MongoDB using randomized filenames. MongoDB stores only receipt metadata and ownership information. Receipt routes require authentication and verify both the expense owner and receipt owner before serving an image.

The current development implementation stores receipt files locally under `backend/storage/receipts`. For production, use persistent storage or a private cloud object store and update the storage adapter without exposing credentials to the frontend.

## Production Deployment Checklist

- Use MongoDB Atlas or a transaction-capable replica-set deployment.
- Set `NODE_ENV=production`.
- Use a strong randomly generated `JWT_SECRET`.
- Configure the deployed frontend URL in `CLIENT_URL`.
- Serve the frontend over HTTPS.
- Use secure, persistent private receipt storage.
- Configure backups and database monitoring.
- Keep the recurring scheduler running as a single worker or add a distributed lock for multi-instance deployments.
- Run migrations or indexes before accepting production traffic.
- Review the data-deletion retention policy before deployment.

## Data Deletion Policy

Account deletion requires the current password and typing `DELETE`. It permanently removes the user's financial records, account data, settings, custom categories, notifications, recurring history, and locally stored receipt files. The current application does not provide restoration after deletion.

Organizations with legal or compliance retention requirements should replace immediate deletion with a documented anonymization and retention workflow before production use.

## Academic Value

This project demonstrates more than CRUD screens. It applies:

- REST API design
- Authentication and authorization
- Password security
- Database schema design
- MongoDB indexing
- Atomic transactions
- Idempotent request handling
- Server-side scheduling
- File validation and private storage
- Financial aggregation
- Data export design
- Responsive React UI development
- Regression testing and integration testing

It is small enough to understand, yet rich enough to demonstrate how a real-world full-stack system protects data and maintains consistency as features grow.

## Project Status

The application is suitable for academic demonstration and staging deployment. Core backend tests, phase smoke tests, frontend linting, frontend production builds, and local API health checks have been verified.

Before production deployment, configure persistent receipt storage, verify the scheduler deployment model, and perform automated browser testing across supported mobile, tablet, and desktop viewports.

## License

This project is intended for educational and personal use. Add a formal license here if the project is published or distributed publicly.
