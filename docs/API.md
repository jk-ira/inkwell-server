# API reference

Base URL: `http://localhost:4000/api` · JSON in / JSON out · auth: `Authorization: Bearer <token>`

Success: `{ "data": ..., "pagination"?: { page, limit, total, totalPages } }`
Error:   `{ "error": { "message": "...", "details"?: [{ field, message }] } }`
Status codes: 200/201 ok · 400 validation · 401 not logged in / bad token · 403 forbidden / suspended · 404 · 409 duplicate · 429 rate limited

Legend: 🌐 public · 🔑 logged in · 🛡️ admin

## Auth
| | Endpoint | Body | Returns |
|---|---|---|---|
| 🌐 | `POST /auth/register` | `{ username, email, password, displayName? }` | 201 `{ user, token }` |
| 🌐 | `POST /auth/login` | `{ identifier (email or username), password }` | `{ user, token }` |
| 🔑 | `GET /auth/me` | - | `{ user }` |
| 🔑 | `PATCH /auth/me` | `{ displayName?, bio? }` | `{ user }` |
| 🔑 | `POST /auth/change-password` | `{ currentPassword, newPassword }` | `{ token }` (old tokens stop working) |

## Posts
| | Endpoint | Notes |
|---|---|---|
| 🌐 | `GET /posts?page&limit&q&author&sort` | published posts only; `sort` = newest\|oldest\|popular; list items have no `content` |
| 🌐 | `GET /posts/:idOrSlug` | published → anyone; draft/hidden → author or admin. Includes `likedByMe` when logged in |
| 🔑 | `POST /posts` | `{ title, content, coverImageUrl?, status: "draft"\|"published" }` → 201 |
| 🔑 | `PATCH /posts/:id` | any of `title, content, coverImageUrl, status (draft\|published)`; owner or admin |
| 🔑 | `DELETE /posts/:id` | owner or admin |
| 🔑 | `GET /me/posts?status&page&limit` | my posts incl. drafts and hidden |
| 🌐 | `GET /users/:username` | public profile |
| 🌐 | `GET /users/:username/posts?page&limit` | that user's published posts |

Post object: `{ id, title, slug, excerpt, content?, coverImageUrl, status, publishedAt, createdAt, updatedAt, author:{id,username,displayName}, counts:{likes,comments,shares}, likedByMe }`

## Interactions
| | Endpoint | Body / returns |
|---|---|---|
| 🔑 | `POST /posts/:id/like` | `{ liked: true, likeCount }` (idempotent) |
| 🔑 | `DELETE /posts/:id/like` | `{ liked: false, likeCount }` |
| 🌐 | `GET /posts/:id/comments` | threaded tree: `[{ id, author, content, status, createdAt, updatedAt, replies: [...] }]` (removed comments have `content: null`) |
| 🔑 | `POST /posts/:id/comments` | `{ content, parentId? }` (parentId = reply) → 201 comment |
| 🔑 | `PATCH /comments/:id` | `{ content }` - author only |
| 🔑 | `DELETE /comments/:id` | author (or admin) |
| 🔑 | `POST /posts/:id/share` | `{ platform: link\|twitter\|facebook\|whatsapp\|linkedin\|email\|other }` → 201 `{ platform, shareCount, shareUrl, links:{twitter,facebook,whatsapp,linkedin,email} }` |

## Admin (all 🛡️)
| Endpoint | Notes |
|---|---|
| `GET /admin/stats` | `{ users, posts, comments, likes, shares }` totals |
| `GET /admin/users?q&role&status&page&limit` | includes `postCount`, `commentCount` |
| `PATCH /admin/users/:id` | `{ role?: user\|admin, status?: active\|suspended }` (not on yourself) |
| `DELETE /admin/users/:id` | cascades to their content (not yourself) |
| `GET /admin/posts?q&author&status&sort&page&limit` | all statuses |
| `PATCH /admin/posts/:id/status` | `{ status: draft\|published\|hidden }` |
| `DELETE /admin/posts/:id` | |
| `GET /admin/comments?q&status&page&limit` | items include `post:{id,title,slug}` |
| `PATCH /admin/comments/:id/status` | `{ status: visible\|hidden }` |
| `DELETE /admin/comments/:id` | |
| `GET /admin/audit-log?page&limit` | who did what |
