# INVENZO

INVENZO is a simple, secure stock-keeping app for a small business. It tracks products and stock and records sales against the invoice numbers from your billing system. Only Admins change products and stock; an Employee's sales wait for an Admin's approval.

Invoices themselves are made in your separate billing system. This app only records *what was sold on which invoice*, so stock stays right.

- **Inventory:** products with brand, HSN, SKU, unit, description, prices and GST %. Each product keeps a full stock history: opening stock, every sale and every adjustment, with who did it and when.
- **Sales:** record an invoice number and the products sold. Stock is deducted automatically, all-or-nothing, and a sale is blocked if stock is short. An Admin's sale is deducted at once; an Employee's sale goes to an Admin and is deducted when approved. Admins can edit or cancel a sale, and the stock is put right.
- **Requests:** Employees' sales, and their requests to correct or cancel a sale, wait here. An Admin approves (stock updates automatically) or rejects (nothing changes).
- **Search:** one search bar across name, brand, HSN, SKU and description. Filter by brand, unit and stock level, and sort by name, stock or price.
- **Users:** Admin and Employee roles, enforced on the server. Admins create users, reset passwords and deactivate accounts. The last Admin can never be removed.
- **Also included:**
  - an audit log of every change
  - CSV and Excel export
  - CSV bulk import
  - daily encrypted backups
  - a phone-friendly layout

## Who can do what

| | Admin | Employee |
|---|:-:|:-:|
| View inventory, search, product history | ✅ | ✅ |
| See purchase (cost) price | ✅ | – |
| Add / edit / archive / delete products, adjust stock, units, import | ✅ | – |
| Record a sale | ✅ (stock deducted at once) | ✅ (deducted when an Admin approves) |
| Edit or cancel a sale | ✅ | Request |
| Approve or reject requests | ✅ | – |
| Export inventory | ✅ | ✅ (without cost price) |
| Export sales | ✅ | – |
| Users, audit log | ✅ | – |

The full list lives in [`src/lib/permissions.ts`](src/lib/permissions.ts), and a test checks every rule.

---

## Running it on your computer

**You need:** Node.js 20 or newer (`node -v`), and a free [Neon](https://neon.tech) database. Nothing else needs installing.

1. Copy the settings file and fill it in:
   ```bash
   cp .env.example .env
   ```
   - **`DATABASE_URL`**: from Neon → **Connect**, with *Connection pooling* **on**.
   - **`DIRECT_URL`**: the same, with pooling **off**.
   - **`BETTER_AUTH_SECRET`**: run `openssl rand -hex 32` and paste the result.
2. Install, create the tables and add sample data:
   ```bash
   npm install
   npm run db:deploy
   npm run db:seed
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.
4. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`, or as `employee@example.com` / `Employee-2026`. That sample Employee only exists on your computer, never on the live site.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on your computer |
| `npm test` | Run the automated tests (needs `TEST_DATABASE_URL`, see below) |
| `npm run typecheck` / `npm run lint` | Check the code for mistakes |
| `npm run db:migrate` | After changing `prisma/schema.prisma`: create and apply a migration |
| `npm run db:deploy` | Apply existing migrations to the database |
| `npm run db:seed` | Add units, the first Admin and (not in production) sample data |
| `npm run db:studio` | Browse the database in your web browser |

### Running tests

The tests use a **separate** database, which is wiped at the start of every run:
1. In Neon, open your project → **Branches** → **Create branch** and name it `test`.
2. Copy its connection string (pooling **off**) into `TEST_DATABASE_URL` in `.env`.
3. Run `npm test`.

The test setup refuses to run if `TEST_DATABASE_URL` points at the same database as `DATABASE_URL`. The tests cover:
- stock deduction and the stock history
- overselling, including two people selling the last items at the same moment
- duplicate invoice numbers
- editing and cancelling sales
- every request type
- every permission rule
- search, import and export

---

## Putting it online

Follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. It's written step by step for non-developers and covers:
- GitHub, Vercel and a Neon production database
- your own domain with HTTPS
- password-reset emails
- daily backups, and how to restore them

---

## How it's built

- **Next.js 16** (App Router, Server Actions, Cache Components), **TypeScript**, **Tailwind CSS 4**, **shadcn/ui**
- **PostgreSQL** on Neon, using **Prisma 7**
- **Better Auth** for sign-in:
  - email and password, hashed with Argon2id
  - sessions stored in the database, in HTTP-only cookies
  - built-in sign-in rate limiting
  - checks that requests come from your own site
- **Vitest** for tests, **zod** for checking every input

```
prisma/            schema.prisma (tables), migrations/, seed.ts
src/app/           pages: (auth)/ login & setup, (app)/ everything after sign-in, api/ downloads & search
src/server/        all business logic: stock.ts, sales.ts, products.ts, requests.ts, users.ts, import.ts
src/server/actions server actions (each checks permission + validates input via defineAction)
src/server/queries read-only data loading for pages
src/components/    UI pieces; src/components/ui = shadcn/ui
src/lib/           permissions, validation rules, formatting
tests/             automated tests
```

### How stock stays correct

- **One gateway.** Every stock change goes through `applyStockChange` in [`src/server/stock.ts`](src/server/stock.ts). It writes a stock-history row and updates the product's running total *in the same database transaction*, so the history always adds up to the stock figure.
- **No overselling.** Stock is removed with a single conditional update ("subtract 5 only if at least 5 are left"). When two sales race for the last items, exactly one wins. The database also refuses negative stock with a `CHECK` constraint.
- **All-or-nothing sales.** A sale and all its stock changes happen in one transaction. Products are always processed in the same order, so simultaneous sales can't get stuck waiting for each other. Editing or cancelling a sale locks it first, so an edit and a cancel can't both put stock back.
- **No duplicate invoices.** Invoice numbers are compared ignoring capitals and spaces, and the database enforces uniqueness. A cancelled sale frees its number.
- **Safe approvals.** Approving a request re-checks it and runs exactly the same code as an Admin's own action.
