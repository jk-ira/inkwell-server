# Social Publisher - API server

Node.js + Express + **Sequelize (v6) + sequelize-cli** + PostgreSQL. Runs locally, no Docker.

## Requirements
- Node.js 18+ (tested on 22)
- PostgreSQL 13+ running locally (`gen_random_uuid()` is used). The DB user needs permission to create databases for `db:create`; otherwise create the database yourself.

## Setup
```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `.env`:
1. `DATABASE_URL` - `postgres://USER:PASSWORD@localhost:5432/social_publisher`
2. `JWT_SECRET` - at least 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
3. `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` - the admin account created by the seeder

Then:
```bash
npm run db:create     # npx sequelize-cli db:create
npm run db:migrate    # npx sequelize-cli db:migrate
npm run db:seed       # admin user + demo users, posts, comments, likes, shares
npm run dev           # http://localhost:4000  (or: npm start)
```
Check: http://localhost:4000/api/health

Demo accounts (seeded): `demo_alice`, `demo_bob`, `demo_carol` - password `Password123`. Admin: your `ADMIN_*` values.
Want a clean database without demo data? Run only the admin seeder:
`npx sequelize-cli db:seed --seed 20260929000001-admin-user.js`

### Useful commands
| Command | What it does |
|---|---|
| `npm run db:migrate:undo` | roll back the last migration |
| `npm run db:migrate:undo:all` | roll back everything |
| `npm run db:seed:undo` | remove seeded data |
| `npm run db:reset` | undo all, migrate, seed |
| `npm test` | integration tests (need a migrated database) |

## Layout
```
.sequelizerc, config/database.js     sequelize-cli configuration (reads DATABASE_URL)
migrations/                          5 JS migrations (users, posts, comments, likes+shares, admin_actions)
seeders/                             admin user, demo data
src/
  server.js, app.js, config.js
  models/      Sequelize models + associations: User, Post, Comment, Like, Share, AdminAction (index.js)
  services/    data access (queries built with the models)
  routes/      auth, posts, comments, users (+ /me/posts), admin
  middleware/  auth (JWT), validate (zod), rateLimit, error
  utils/       http, schemas, text (sanitising, slugs), sql
tests/api.test.js
docs/API.md                          full endpoint reference
```

## Database
`users` · `posts` · `comments` (self-referencing `parent_id` for replies) · `likes` (composite PK post+user) · `shares` · `admin_actions` (audit log) · `SequelizeMeta` (applied migrations).
The schema is created only by migrations (never `sequelize.sync()`). Foreign keys cascade, so deleting a post or user removes its comments, likes and shares. CHECK constraints enforce roles/statuses and case-insensitive unique indexes cover usernames and emails.

## Security measures
- Passwords hashed with bcrypt (cost 12); minimum 8 chars, letter + number; max 72 (bcrypt limit)
- JWT (HS256, explicit algorithm on verify, 7-day expiry) in the `Authorization: Bearer` header; the account is re-loaded from the DB on every request, so suspended/deleted users are locked out immediately; changing password invalidates older tokens
- Role-based authorization (`user` / `admin`) plus ownership checks on posts and comments
- Every input validated with zod; queries go through Sequelize (parameterised); the few raw SQL fragments contain no user input (viewer id is escaped)
- HTML tags stripped from all user text before storing; API only returns JSON; the frontend must render text as text
- helmet security headers, CORS allow-list, 100 kb body limit, rate limiting (300 req/15 min per IP; 20/15 min on login/register/change-password)
- One generic login error for wrong email/username or password, with equalised timing
- Drafts and moderator-hidden posts are never served publicly; a hidden post's status cannot be reversed by its author
- Admin actions are written to an audit log

See `docs/API.md` for endpoints (unchanged from the previous version).
