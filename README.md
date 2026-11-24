# Inkspire Blog

A complete full-stack blogging platform with user registration, login, post management, and threaded community discussion.

## Features

- Secure registration and login with scrypt password hashing
- HTTP-only cookie sessions stored in SQLite
- Create, edit, and delete your own posts
- Draft and published post states
- Comments on published posts with author-controlled deletion
- RESTful JSON API and persistent SQLite database
- Search, category filters, responsive layout, and accessible forms

## Run locally

Requires Node.js 22.5 or newer (the application uses Node's built-in SQLite module).

```bash
npm install
npm start
```

Open <http://localhost:3000>. The database is created automatically in `data/blog.db`.

Set `PORT` to use a different port and `SESSION_DAYS` to change the default 7-day session lifetime.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Get the current user |
| `GET` | `/api/posts` | List published posts (or the signed-in user's drafts) |
| `POST` | `/api/posts` | Create a post |
| `GET` | `/api/posts/:id` | Read one post and its comments |
| `PUT` | `/api/posts/:id` | Update your post |
| `DELETE` | `/api/posts/:id` | Delete your post |
| `POST` | `/api/posts/:id/comments` | Add a comment |
| `DELETE` | `/api/comments/:id` | Delete your comment |

