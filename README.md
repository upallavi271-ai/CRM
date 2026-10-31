# CRM

Customer Relationship Management app: NestJS + PostgreSQL + Prisma backend, React + Vite + Tailwind frontend.

## Ippudu emi undi

| Part | Status |
|---|---|
| Login (JWT), roles & permissions (RBAC, `Module.Action`) | ✅ |
| Audit log (evaru, eppudu, em marcharu) + soft delete | ✅ |
| Dashboard: leads, open pipeline, won this month, conversion rate, sales funnel, activity | ✅ |
| CRM Fields: custom fields (Text, Number, Date, Yes/No, Dropdown, Email, Phone), reorder, required | ✅ |
| All Customers: list, search, status/tag/custom-field filters, add/edit/delete, CSV export | ✅ |
| Leads: status tabs, source/assignee filters, score, assign, disqualify (with reason), convert → Customer + Deal (duplicate customer check) | ✅ |
| Deals: Kanban board (drag & drop), configurable pipeline stages, won/lost (lost reason), weighted pipeline value | ✅ |
| Activities, Tasks, Quotes, Invoices, Tickets | Next phase |

Roles seeded: **Admin**, **Sales Manager**, **Sales Executive**, **Support Agent**.
Sales Executive ki tana leads/deals matrame kanipistayi (`Lead.ReadAll` / `Deal.ReadAll` unte team anta).

## Run cheyyadam (daily)

3 terminals open cheyyandi:

```bash
# 1. Database (Docker lekunda). Docker unte: docker compose up -d
cd backend
npm run db:dev
```

```bash
# 2. Backend API → http://localhost:3000/api
cd backend
npm run start:dev
```

```bash
# 3. Frontend → http://localhost:5173
cd frontend
npm run dev
```

Windows lo `start:dev` (watch mode) restart appudu crash ayithe, `npm run start` vadandi (code marchinappudu malli start cheyyali).

Browser lo **http://localhost:5173** open cheyyandi. Login details `backend/.env` lo unnayi
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; `SEED_SALES_EMAIL` = Sales Executive role, same password).

## First time setup (kotha machine lo)

```bash
cd backend
npm install
cp .env.example .env        # JWT_SECRET marchandi
npm run db:dev              # vere terminal lo running ga unchandi
npm run db:migrate          # tables create
npm run db:seed             # roles, admin user, demo data
cd ../frontend
npm install
```

## Useful commands

| Command (backend/) | Em chestundi |
|---|---|
| `npm run db:migrate` | `prisma/schema.prisma` marchaka DB update |
| `npm run db:seed` | Roles / permissions / demo data malli load |
| `npm run db:studio` | Database ni browser lo chudadaniki (Prisma Studio) |
| `npm test` | Unit tests |

## Folder structure

```
backend/
  prisma/schema.prisma     tables (data model)
  prisma/seed.ts           roles, permissions, demo data
  src/common/              auth guard, permission guard, audit log
  src/auth/                login, /auth/me
  src/custom-fields/       CRM Fields API + value validation
  src/customers/           Customers API (filters, export)
  src/leads/               Leads API (assign, convert)
  src/deals/               Deals API (board, stage move)
  src/pipelines/           pipelines + stages
  src/dashboard/           dashboard numbers
frontend/
  src/pages/               Dashboard, Leads, Deals, CrmFields, Customers, Login
  src/components/          Layout (sidebar), Modal, FieldInput
  src/lib/                 api client, auth context, types
```

## Kotha module add cheyyadam (recipe)

1. `schema.prisma` lo model add (base fields: tenant_id, created_by, ..., is_deleted)
2. `npm run db:migrate`
3. `seed.ts` lo permissions add (`Lead.Create` ...), `npm run db:seed`
4. `src/<module>/` lo controller + service + DTO, prati route meeda `@RequirePermissions(...)`
5. Prati create/update/delete lo `audit.log(...)`
6. `frontend/src/pages/` lo page, `main.tsx` lo route, `Layout.tsx` lo sidebar link
