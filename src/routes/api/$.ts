import { createFileRoute } from "@tanstack/react-router";
import app from "@/api";

// every /api/* request is handed to the hono app
const handle = ({ request }: { request: Request }) => app.fetch(request);

export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			GET: handle,
			POST: handle,
		},
	},
});
