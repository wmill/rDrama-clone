# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Technologies

This is a full-stack Reddit/drama community clone built with:
- **TanStack Start** - React framework with file-based routing
- **React 19** - UI framework with latest features
- **Drizzle ORM** - TypeScript-first database toolkit
- **PostgreSQL** - Database
- **Tailwind CSS** - Styling framework
- **Shadcn/ui** - Component library
- **Sentry** - Error tracking and performance monitoring
- **Biome** - Linting and formatting
- **Vitest** - Testing framework

## Development Commands

### Build & Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server on port 3000
pnpm build            # Build for production
pnpm serve            # Preview production build
pnpm start            # Start production server
```

### Code Quality
```bash
pnpm lint             # Run Biome linter
pnpm format           # Format code with Biome
pnpm check            # Run comprehensive Biome checks
pnpm test             # Run Vitest tests
```

### Database Operations
```bash
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes directly
pnpm db:pull          # Pull schema from database
pnpm db:studio        # Open Drizzle Studio
```

### Adding UI Components
```bash
pnpx shadcn@latest add button    # Add specific components
```

## Architecture Overview

### File Structure
- `src/routes/` - File-based routing (TanStack Router)
- `src/components/` - React components
- `src/components/ui/` - Shadcn/ui components
- `src/db/` - Database schema and connection
- `src/lib/` - Utility functions
- `src/integrations/` - Third-party integrations
- `prototyping-data/` - Sample data for development

### Database Schema
Database schema is defined in `src/db/schema.ts` using Drizzle ORM with PostgreSQL. Current schema includes a basic todos table structure that will be extended for the drama community features.

### Routing System
- File-based routing in `src/routes/`
- Root layout in `src/routes/__root.tsx`
- Route tree auto-generated as `src/routeTree.gen.ts`
- SSR and client-side navigation support

### State Management
- TanStack Query for server state
- TanStack Store available for complex client state
- React Context for component-level state

### Styling Approach
- Tailwind CSS with v4 configuration
- Shadcn/ui component system
- Dark mode support built into components
- Custom CSS in `src/styles.css`

### Error Monitoring
- Sentry integration configured in `src/router.tsx`
- Server function instrumentation with `Sentry.startSpan`
- Automatic error collection in production

## Development Patterns

### Adding New Routes
Create files in `src/routes/` - TanStack Router automatically generates route configuration.

### Database Changes
1. Modify `src/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply changes

### Component Development
- Use existing Shadcn/ui components from `src/components/ui/`
- Follow established patterns in existing components
- Import utilities from `@/lib/utils`

### Server Functions
- Wrap lengthy operations with Sentry instrumentation
- Use TanStack Start's server function patterns
- See demo files for examples

### Code Style
- Biome handles formatting (tab indentation, double quotes)
- TypeScript strict mode enabled
- Path aliases configured (`@/*` maps to `./src/*`)

## Demo Files
Files prefixed with `demo.` can be safely deleted - they provide examples for TanStack features and development patterns.

## Environment Setup
- Requires PostgreSQL database
- Set `DATABASE_URL` environment variable
- Sentry DSN in `VITE_SENTRY_DSN` for monitoring

## Testing Strategy
- Vitest for unit and integration tests
- Testing Library for React component testing
- JSDOM for browser environment simulation