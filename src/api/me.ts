import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { clubMembersTable, clubsTable, usersTable } from "@/db/schema";
import type { AuthEnv } from "./auth";
import { db } from "./db";
import { validate } from "./validate";

const me = new Hono<AuthEnv>()
	.get("/", async (c) => {
		const user = c.var.user;

		const clubs = await db
			.select({ id: clubsTable.id, name: clubsTable.name })
			.from(clubMembersTable)
			.innerJoin(clubsTable, eq(clubsTable.id, clubMembersTable.clubId))
			.where(eq(clubMembersTable.userId, user.id))
			.orderBy(clubsTable.name);

		return c.json({ success: true, data: { ...user, clubs } });
	})
	.post(
		"/profile",
		validate(
			"json",
			z.object({
				name: z.string().trim().min(1).max(255),
				phone: z
					.string()
					.trim()
					.regex(/^[6-9]\d{9}$/, "Enter a 10 digit mobile number"),
				clubIds: z.array(z.number().int().positive()),
			}),
		),
		async (c) => {
			const user = c.var.user;
			const { name, phone, clubIds } = c.req.valid("json");

			// superuser clubs are set by the admin, users pick their own
			if (user.role === "user" && clubIds.length === 0) {
				return c.json(
					{ success: false, error: { message: "Pick at least one club" } },
					400,
				);
			}

			await db.transaction(async (tx) => {
				await tx
					.update(usersTable)
					.set({ name, phone })
					.where(eq(usersTable.id, user.id));

				if (user.role === "user") {
					await tx
						.delete(clubMembersTable)
						.where(eq(clubMembersTable.userId, user.id));
					await tx
						.insert(clubMembersTable)
						.values(clubIds.map((clubId) => ({ userId: user.id, clubId })));
				}
			});

			return c.json({ success: true, data: { message: "Profile saved" } });
		},
	);

export default me;
