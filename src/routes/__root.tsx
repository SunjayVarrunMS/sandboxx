import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { client } from "@/lib/api";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	beforeLoad: async () => {
		const res = await client.me.$get();
		const body = await res.json();
		return { user: body.success ? body.data : null };
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Sandboxx" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	ssr: false,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-dvh bg-neutral-50">
				{children}
				<Toaster position="top-right" richColors />
				<Scripts />
			</body>
		</html>
	);
}
