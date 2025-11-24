import { createServerFn } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import {
	Route as RouteIcon,
	Server,
	Shield,
	Sparkles,
	Waves,
	Zap,
} from "lucide-react"

import { RecentSubmissions } from "@/components/recent-submissions"
import { getRecentSubmissions } from "@/lib/submissions.server"

const loadRecentSubmissions = createServerFn({ method: 'GET' }).handler(
	async () => await getRecentSubmissions(25),
)

export const Route = createFileRoute('/')({
	component: App,
	loader: async () => await loadRecentSubmissions(),
})

function App() {
	const features = [
		{
			icon: <Zap className="h-12 w-12 text-cyan-400" />,
			title: 'Powerful Server Functions',
			description:
				'Write server-side code that seamlessly integrates with your client components. Type-safe, secure, and simple.',
		},
		{
			icon: <Server className="h-12 w-12 text-cyan-400" />,
			title: 'Flexible Server Side Rendering',
			description:
				'Full-document SSR, streaming, and progressive enhancement out of the box. Control exactly what renders where.',
		},
		{
			icon: <RouteIcon className="h-12 w-12 text-cyan-400" />,
			title: 'API Routes',
			description:
				'Build type-safe API endpoints alongside your application. No separate backend needed.',
		},
		{
			icon: <Shield className="h-12 w-12 text-cyan-400" />,
			title: 'Strongly Typed Everything',
			description:
				'End-to-end type safety from server to client. Catch errors before they reach production.',
		},
		{
			icon: <Waves className="h-12 w-12 text-cyan-400" />,
			title: 'Full Streaming Support',
			description:
				'Stream data from server to client progressively. Perfect for AI applications and real-time updates.',
		},
		{
			icon: <Sparkles className="h-12 w-12 text-cyan-400" />,
			title: 'Next Generation Ready',
			description:
				'Built from the ground up for modern web applications. Deploy anywhere JavaScript runs.',
		},
	]

	const submissions = Route.useLoaderData<typeof Route>()

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
			<section className="relative overflow-hidden px-6 py-20 text-center">
				<div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
				<div className="relative mx-auto max-w-5xl">
					<div className="mb-6 flex items-center justify-center gap-6">
						<img
							src="/tanstack-circle-logo.png"
							alt="TanStack Logo"
							className="h-24 w-24 md:h-32 md:w-32"
						/>
						<h1 className="text-6xl font-black text-white [letter-spacing:-0.08em] md:text-7xl">
							<span className="text-gray-300">TANSTACK</span>{' '}
							<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
								START
							</span>
						</h1>
					</div>
					<p className="mb-4 text-2xl font-light text-gray-300 md:text-3xl">
						The framework for next generation AI applications
					</p>
					<p className="mx-auto mb-8 max-w-3xl text-lg text-gray-400">
						Full-stack framework powered by TanStack Router for React and Solid.
						Build modern applications with server functions, streaming, and type
						safety.
					</p>
					<div className="flex flex-col items-center gap-4">
						<a
							href="https://tanstack.com/start"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg bg-cyan-500 px-8 py-3 font-semibold text-white shadow-lg shadow-cyan-500/50 transition-colors hover:bg-cyan-600"
						>
							Documentation
						</a>
						<p className="mt-2 text-sm text-gray-400">
							Begin your TanStack Start journey by editing{' '}
							<code className="rounded bg-slate-700 px-2 py-1 text-cyan-400">
								/src/routes/index.tsx
							</code>
						</p>
					</div>
				</div>
			</section>

			<section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 pb-6 md:grid-cols-[2fr_3fr]">
				<div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-xl">
					<div className="mb-4 text-left">
						<p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">
							Framework highlights
						</p>
						<h2 className="text-2xl font-extrabold text-white">Why TanStack</h2>
						<p className="text-sm text-slate-400">
							A quick tour of what this starter is tuned for.
						</p>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-500/50 hover:shadow-cyan-500/10"
							>
								<div className="mb-3">{feature.icon}</div>
								<h3 className="mb-2 text-xl font-semibold text-white">
									{feature.title}
								</h3>
								<p className="leading-relaxed text-gray-400">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>

				<RecentSubmissions submissions={submissions} />
			</section>
		</div>
	)
}
