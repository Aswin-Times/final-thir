# Inkspire Blog Platform

Inkspire is a responsive full-stack blogging platform where people can create an account, publish stories, manage drafts, and take part in conversations through comments.

The application uses a lightweight Node.js and SQLite stack, so it can be installed and run locally without configuring a separate database server.

## Features

### Accounts and security

- User registration, login, and logout
- Passwords hashed with Node.js `scrypt` and a unique salt
- Random, server-side sessions stored in SQLite
- HTTP-only, same-site session cookies
- Ownership checks for editing and deleting content
- Request validation and parameterized database queries

### Stories

- Create, edit, and delete stories
- Save stories as drafts or publish them immediately
- Personal **My stories** dashboard
- Search stories by title, introduction, or content
- Filter stories by category
- Responsive story cards and reading view

### Comments

- Comment on published stories
- View conversations in chronological order
- Delete your own comments
- Automatic comment counts on story cards

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | Semantic HTML, modern CSS, vanilla JavaScript |
| Backend | Node.js and Express 5 |
| Database | Node.js built-in SQLite module |
| Authentication | Cookie sessions, `scrypt`, and SHA-256 token hashing |

## Requirements

- Node.js 22.5 or newer
- npm 10 or newer

The project uses Node's built-in `node:sqlite` module, which is not available in older Node.js releases.

## Getting started

1. Clone the repository:

   ```bash
   git clone https://github.com/Aswin-Times/final-thir.git
   cd final-thir
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the application:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in a browser.

The application creates its SQLite database automatically at `data/blog.db` on first launch. The `data` directory is ignored by Git so local accounts and content are never committed.

For development with automatic server restarts, run:

```bash
npm run dev
```

## Configuration

Configuration is optional and is supplied through environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port used by the server |
| `SESSION_DAYS` | `7` | Number of days before a login session expires |
| `NODE_ENV` | — | Set to `production` to enable secure cookies over HTTPS |

PowerShell example:

```powershell
$env:PORT = 4000
$env:SESSION_DAYS = 14
npm start
```

## Project structure

```text
final-thir/
├── public/
│   ├── app.js          # Frontend state, API calls, and interactions
│   ├── index.html      # Application interface and dialogs
│   └── styles.css      # Responsive visual design
├── server.js           # Express API, authentication, and database setup
├── package.json        # Dependencies and npm scripts
├── package-lock.json   # Locked dependency versions
└── README.md           # Project documentation
```

## REST API

All request and response bodies use JSON. Routes that modify stories or comments require a valid session cookie.

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and start a session |
| `POST` | `/api/auth/login` | Log in and start a session |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/me` | Return the currently authenticated user |

Registration request example:

```json
{
  "name": "Asha Writer",
  "email": "asha@example.com",
  "password": "a-secure-password"
}
```

### Stories

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/posts` | List published stories |
| `GET` | `/api/posts?q=design` | Search published stories |
| `GET` | `/api/posts?category=Technology` | Filter stories by category |
| `GET` | `/api/posts?mine=1` | List the signed-in user's stories and drafts |
| `POST` | `/api/posts` | Create a story |
| `GET` | `/api/posts/:id` | Read a story and its comments |
| `PUT` | `/api/posts/:id` | Update one of your stories |
| `DELETE` | `/api/posts/:id` | Delete one of your stories |

Story request example:

```json
{
  "title": "Designing for curious minds",
  "excerpt": "A practical introduction to making ideas easier to explore.",
  "content": "Your complete story goes here and must contain at least 20 characters.",
  "category": "Design",
  "status": "published"
}
```

Use `"status": "draft"` to keep a story private.

### Comments

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/posts/:id/comments` | Add a comment to a published story |
| `DELETE` | `/api/comments/:id` | Delete one of your comments |

Comment request example:

```json
{
  "content": "This gave me a new way to think about the topic."
}
```

## Database

The server automatically creates these tables:

- `users` — account details and password hashes
- `sessions` — hashed login tokens and expiration dates
- `posts` — stories, drafts, categories, and timestamps
- `comments` — conversations linked to stories and users

Foreign keys and cascading deletes keep the data consistent. Deleting a story also removes its comments, while deleting a user removes their sessions and authored content.

## Available scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the production server |
| `npm run dev` | Start the server in Node.js watch mode |
| `npm test` | Run the Node.js test runner |

## Verification

The application has been checked with:

- JavaScript syntax validation for the backend and frontend
- Dependency security audit
- End-to-end API testing for registration, authentication, story CRUD, comments, and logout
- Desktop and responsive browser rendering checks

## License

This project is provided for educational and portfolio use.
