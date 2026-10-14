import { and, count, eq, gt, ne } from "drizzle-orm";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";
import { accessRequestsTable, lockEventsTable, usersTable } from "@/db/schema";
import env from "@/lib/env";
import { db } from "./db";
import { validate } from "./validate";

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 5;

// called by the esp32, which sends LOCK_API_KEY instead of a login cookie
const lock = new Hono()
	.use(bearerAuth({ token: env.LOCK_API_KEY }))
	.post(
		"/verify",
		validate("json", z.object({ pin: z.string().regex(/^\d{6}$/) })),
		async (c) => {
			const { pin } = c.req.valid("json");
			const now = new Date();
			const windowStart = new Date(now.getTime() - LOCKOUT_MINUTES * 60 * 1000);

			const [{ failures }] = await db
				.select({ failures: count() })
				.from(lockEventsTable)
				.where(
					and(
						ne(lockEventsTable.result, "granted"),
						gt(lockEventsTable.createdAt, windowStart),
					),
				);

			if (failures >= MAX_FAILURES) {
				await db.insert(lockEventsTable).values({ result: "locked_out" });
				return c.json({
					success: true,
					data: { open: false, reason: "locked_out" },
				});
			}

			const [request] = await db
				.select({
					id: accessRequestsTable.id,
					userId: accessRequestsTable.userId,
					name: usersTable.name,
				})
				.from(accessRequestsTable)
				.innerJoin(usersTable, eq(usersTable.id, accessRequestsTable.userId))
				.where(
					and(
						eq(accessRequestsTable.pin, pin),
						eq(accessRequestsTable.status, "approved"),
						gt(accessRequestsTable.expiresAt, now),
					),
				)
				.limit(1);

			if (!request) {
				await db.insert(lockEventsTable).values({ result: "denied" });
				return c.json({
					success: true,
					data: { open: false, reason: "wrong_pin" },
				});
			}

			await db.insert(lockEventsTable).values({
				result: "granted",
				userId: request.userId,
				requestId: request.id,
			});

			return c.json({
				success: true,
				data: { open: true, name: request.name },
			});
		},
	);

export default lock;
