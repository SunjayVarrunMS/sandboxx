import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import admin from "./admin";
import auth, { type AuthEnv, requireUser } from "./auth";
import clubs from "./clubs";
import lock from "./lock";
import logs from "./logs";
import me from "./me";
import requests from "./requests";

const authenticated = new Hono<AuthEnv>()
	.use(requireUser)
	.route("/me", me)
	.route("/clubs", clubs)
	.route("/requests", requests)
	.route("/logs", logs)
	.route("/admin", admin);

const app = new Hono()
	.basePath("/api")
	.route("/auth", auth)
	.route("/lock", lock)
	.route("/", authenticated);

app.onError((err, c) => {
	// errors hono throws on purpose, like bearerAuth's 401, keep their status
	if (err instanceof HTTPException) {
		return c.json(
			{ success: false, error: { message: err.message || "Unauthorized" } },
			err.status,
		);
	}
	console.error(err);
	return c.json(
		{ success: false, error: { message: "Something went wrong" } },
		500,
	);
});

export type AppType = typeof app;
export default app;
