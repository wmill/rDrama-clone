Project to rewrite the themotte/rDrama codebase in node & react because the flask / jinja / bootstrap site got unwheildly. Aims to be completely db compatable. Uses tanstack start. 

Documentation about the old site is in project_specs.

The specs include generated test db data so that llms will have something to inspect.

Project goal is to move the threading to the client as much as possible. Running recursive queries puts a lot of load on the db when bots hit the page, and a few thousand comments isn't going to cause any problem on modern devices. 

I had to chunk the rendering of full comment threads because react is not happy when you try to insert that many dom nodes at once. The browser notcibly froze.

There's a new ltree column on comments to make things a lot easier when you're viewing a single comment and need to find it's ancestors & children. 

I've been focussed on rendering, the admin and moderation stuff is still missing. Not production ready, but you can point it at a copy of your rdrama based site's db and play around with it.


# Getting Started

To run this application:

# Set up .env.local

```bash
mv .env.local.sample .env.local
```

```bash
pnpm install
pnpm dev
```

# Set up Postgres and Redis using docker

```bash
docker commpose up -d postgres redis
```

# Generate some sample data to get going on development

```bash
pnpm generate-data --comments 5000 --max-depth 30 --submissions 30
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing. You can run the tests with:

```bash
pnpm test
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.


## Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting. The following scripts are available:


```bash
pnpm lint
pnpm format
pnpm check
```

## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpx shadcn@latest add button
```

