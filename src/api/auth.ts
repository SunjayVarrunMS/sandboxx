import { eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { type Role, usersTable } from "@/db/schema";
import env from "@/lib/env";
import { db } from "./db";
import { validate } from "./validate";

const BITS_DOMAIN = "hyderabad.bits-pilani.ac.in";
const SESSION_DAYS = 7;

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export type User = typeof usersTable.$inferSelect;
export type AuthEnv = { Variables: { user: User } };

const auth = new Hono()
	.post(
		"/login",
		validate("json", z.object({ token: z.string() })),
		async (c) => {
			const { token } = c.req.valid("json");

			let email: string | undefined;
			let name: string | undefined;
			let domain: string | undefined;
			try {
				const ticket = await googleClient.verifyIdToken({
					idToken: token,
					audience: env.GOOGLE_CLIENT_ID,
				});
				const payload = ticket.getPayload();
				if (payload?.email_verified) {
					email = payload.email?.toLowerCase();
					name = payload.name;
					domain = payload.hd;
				}
			} catch {
				return c.json(
					{ success: false, error: { message: "Invalid Google login" } },
					401,
				);
			}

			if (!email || domain !== BITS_DOMAIN) {
				return c.json(
					{
						success: false,
						error: { message: "Please use your BITS Hyderabad email" },
					},
					403,
				);
			}

			let [user] = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1);

			if (!user) {
				[user] = await db
					.insert(usersTable)
					.values({ email, name: name ?? email })
					.returning();
			}

			await startSession(c, user.id);
			return c.json({ success: true, data: user });
		},
	)
	.post(
		"/dev-login",
		validate("json", z.object({ email: z.email() })),
		async (c) => {
			if (!env.DEV_LOGIN || env.PROD) {
				return c.json({ success: false, error: { message: "Not found" } }, 404);
			}

			const { email } = c.req.valid("json");
			const [user] = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email.toLowerCase()))
				.limit(1);

			if (!user) {
				return c.json(
					{ success: false, error: { message: "No user with that email" } },
					404,
				);
			}

			await startSession(c, user.id);
			return c.json({ success: true, data: user });
		},
	)
	.post("/logout", (c) => {
		deleteCookie(c, "token", { path: "/" });
		return c.json({ success: true, data: null });
	});

export default auth;

// the cookie only holds the user id, so role changes apply on the next request
const startSession = async (c: Context, userId: number) => {
	const expiresIn = SESSION_DAYS * 24 * 60 * 60;
	const token = await sign(
		{ sub: userId, exp: Math.floor(Date.now() / 1000) + expiresIn },
		env.JWT_SECRET,
	);
	setCookie(c, "token", token, {
		path: "/",
		httpOnly: true,
		secure: env.PROD,
		sameSite: "Lax",
		maxAge: expiresIn,
	});
};

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
	const token = getCookie(c, "token");
	if (!token) {
		return c.json({ success: false, error: { message: "Not logged in" } }, 401);
	}

	let userId: number;
	try {
		const payload = await verify(token, env.JWT_SECRET, "HS256");
		userId = Number(payload.sub);
	} catch {
		return c.json(
			{ success: false, error: { message: "Session expired" } },
			401,
		);
	}

	const [user] = await db
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);

	if (!user) {
		return c.json({ success: false, error: { message: "Not logged in" } }, 401);
	}

	c.set("user", user);
	await next();
});

export const requireRole = (...allowed: Role[]) =>
	createMiddleware<AuthEnv>(async (c, next) => {
		if (!allowed.includes(c.var.user.role)) {
			return c.json(
				{
					success: false,
					error: { message: "You are not allowed to do this" },
				},
				403,
			);
		}
		await next();
	});
