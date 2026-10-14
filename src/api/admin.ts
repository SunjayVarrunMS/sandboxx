import { and, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
	accessRequestsTable,
	clubMembersTable,
	clubsTable,
	lockEventsTable,
	usersTable,
} from "@/db/schema";
import { type AuthEnv, requireRole } from "./auth";
import { db } from "./db";
import { validate } from "./validate";

const idParam = z.object({ id: z.coerce.number().int().positive() });

type SuperUser = {
	id: number;
	name: string;
	email: string;
	phone: string | null;
	clubs: string[];
};

const admin = new Hono<AuthEnv>()
	.use(requireRole("admin"))
	.post(
		"/clubs",
		validate("json", z.object({ name: z.string().trim().min(1).max(255) })),
		async (c) => {
			const { name } = c.req.valid("json");

			const [club] = await db
				.insert(clubsTable)
				.values({ name })
				.onConflictDoNothing()
				.returning();

			if (!club) {
				return c.json(
					{ success: false, error: { message: "Club already exists" } },
					409,
				);
			}

			return c.json({ success: true, data: club });
		},
	)
	.post("/clubs/:id/delete", validate("param", idParam), async (c) => {
		const { id } = c.req.valid("param");
		await db.delete(clubsTable).where(eq(clubsTable.id, id));
		return c.json({ success: true, data: { message: "Club deleted" } });
	})
	.get("/superusers", async (c) => {
		const rows = await db
			.select({
				id: usersTable.id,
				name: usersTable.name,
				email: usersTable.email,
				phone: usersTable.phone,
				clubName: clubsTable.name,
			})
			.from(usersTable)
			.leftJoin(clubMembersTable, eq(clubMembersTable.userId, usersTable.id))
			.leftJoin(clubsTable, eq(clubsTable.id, clubMembersTable.clubId))
			.where(eq(usersTable.role, "superuser"))
			.orderBy(usersTable.name);

		const superUsers = rows.reduce((acc, r) => {
			if (!acc.has(r.id)) {
				acc.set(r.id, {
					id: r.id,
					name: r.name,
					email: r.email,
					phone: r.phone,
					clubs: [],
				});
			}
			if (r.clubName) {
				acc.get(r.id)?.clubs.push(r.clubName);
			}
			return acc;
		}, new Map<number, SuperUser>());

		return c.json({ success: true, data: Array.from(superUsers.values()) });
	})
	.post(
		"/superusers",
		validate(
			"json",
			z.object({
				email: z
					.email()
					.toLowerCase()
					.endsWith("@hyderabad.bits-pilani.ac.in", "Must be a BITS email"),
				name: z.string().trim().min(1).max(255),
				phone: z
					.string()
					.trim()
					.regex(/^[6-9]\d{9}$/, "Enter a 10 digit mobile number"),
				clubIds: z.array(z.number().int().positive()).min(1),
			}),
		),
		async (c) => {
			const { email, name, phone, clubIds } = c.req.valid("json");

			// creates the account if they haven't logged in yet
			await db.transaction(async (tx) => {
				const [user] = await tx
					.insert(usersTable)
					.values({ email, name, phone, role: "superuser" })
					.onConflictDoUpdate({
						target: usersTable.email,
						set: { name, phone, role: "superuser" },
					})
					.returning({ id: usersTable.id });

				await tx
					.delete(clubMembersTable)
					.where(eq(clubMembersTable.userId, user.id));
				await tx
					.insert(clubMembersTable)
					.values(clubIds.map((clubId) => ({ userId: user.id, clubId })));
			});

			return c.json({ success: true, data: { message: "SuperUser saved" } });
		},
	)
	.post("/superusers/:id/remove", validate("param", idParam), async (c) => {
		const { id } = c.req.valid("param");

		const res = await db
			.update(usersTable)
			.set({ role: "user" })
			.where(and(eq(usersTable.id, id), eq(usersTable.role, "superuser")));

		if (res.rowCount !== 1) {
			return c.json(
				{ success: false, error: { message: "User not found" } },
				404,
			);
		}

		return c.json({ success: true, data: { message: "SuperUser removed" } });
	})
	.post(
		"/wipe",
		validate("json", z.object({ confirm: z.literal("WIPE") })),
		async (c) => {
			// yearly reset: admins and clubs stay, everything else goes
			await db.transaction(async (tx) => {
				await tx.delete(lockEventsTable);
				await tx.delete(accessRequestsTable);
				await tx.delete(usersTable).where(ne(usersTable.role, "admin"));
			});

			return c.json({ success: true, data: { message: "Year wiped" } });
		},
	);

export default admin;
