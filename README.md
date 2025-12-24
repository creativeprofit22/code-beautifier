# Code Beautifier

A Next.js application for code formatting and syntax highlighting, with an integrated AI-powered **Interceptor Toolkit** for HTTP traffic capture, API analysis, and security scanning.

## Features

- **Code Beautifier** - Syntax highlighting and formatting for multiple languages
- **Interceptor Toolkit** - Capture and analyze HTTP traffic
  - AI Chat Assistant (powered by Claude)
  - Security vulnerability scanning
  - OpenAPI spec generation
  - Traffic analysis and pattern detection

## Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- PostgreSQL database
- [Claude Code CLI](https://github.com/anthropics/claude-code) (optional, for AI chat assistant)

### Installation

**Option 1: One-command setup**
```bash
git clone https://github.com/creativeprofit22/code-beautifier.git
cd code-beautifier
npm run setup
```

**Option 2: Manual setup**
```bash
# Clone the repository
git clone https://github.com/creativeprofit22/code-beautifier.git
cd code-beautifier

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate Prisma client
npx prisma generate
```

### Configuration

Edit `.env` with your values:

```bash
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/code_beautifier"

# Auth.js secret (required) - generate with: npx auth secret
AUTH_SECRET="your-generated-secret"

# GitHub OAuth (required for authentication)
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# App URL (optional)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### Setting up GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Code Beautifier
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret to your `.env`

### Database Setup

```bash
# Push schema to database
npm run db:push

# Or run migrations (for production)
npm run db:migrate
```

### Running the App

```bash
# Development (with Turbopack - faster)
npm run dev

# Development (standard Next.js)
npm run dev:standard

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | One-command installation and setup |
| `npm run dev` | Start dev server with Turbopack |
| `npm run dev:standard` | Start dev server (standard) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Run tests with Vitest |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |

## Interceptor Toolkit (Built-in)

The Interceptor Toolkit is fully integrated - no separate installation needed.

### Features

- **Traffic Capture** - Capture HTTP requests/responses via proxy
- **Security Scanning** - Find vulnerabilities (OWASP Top 10)
- **OpenAPI Generation** - Generate API specs from traffic
- **AI Assistant** - Natural language interface powered by Claude

### Optional: Claude Code CLI

For AI chat functionality, install Claude Code:

```bash
npm install -g @anthropic-ai/claude-code
```

### Using the Interceptor

1. Navigate to `/interceptor` in the app
2. View and manage capture sessions
3. Run security scans on captured traffic
4. Generate OpenAPI specs from your API calls
5. Use the AI chat assistant for guided analysis

Example chat commands:
- "List my sessions"
- "Scan the latest session for security issues"
- "Generate an OpenAPI spec from session abc123"

## Project Structure

```
code-beautifier/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   └── interceptor/     # Interceptor Toolkit UI
│   ├── features/            # Feature modules
│   │   └── interceptor/     # Interceptor components
│   ├── lib/                 # Shared utilities
│   │   ├── chat-agent.ts    # Claude chat integration
│   │   ├── interceptor.ts   # Interceptor CLI wrapper
│   │   └── theme.ts         # Theme constants
│   └── components/          # Shared UI components
├── prisma/                  # Database schema
├── public/                  # Static assets
└── reports/                 # Generated reports
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Auth.js (NextAuth v5)
- **API**: tRPC
- **Testing**: Vitest + Playwright
- **Linting**: ESLint + Prettier

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.
