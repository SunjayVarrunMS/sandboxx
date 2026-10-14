import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { clubMembersTable, clubsTable, usersTable } from "@/db/schema";
import type { AuthEnv } from "./auth";
import { db } from "./db";

type Club = {
	id: number;
	name: string;
	superUsers: { name: string; phone: string | null }[];
};

const clubs = new Hono<AuthEnv>().get("/", async (c) => {
	const rows = await db
		.select({
			id: clubsTable.id,
			name: clubsTable.name,
			superUserName: usersTable.name,
			superUserPhone: usersTable.phone,
		})
		.from(clubsTable)
		.leftJoin(clubMembersTable, eq(clubMembersTable.clubId, clubsTable.id))
		.leftJoin(
			usersTable,
			and(
				eq(usersTable.id, clubMembersTable.userId),
				eq(usersTable.role, "superuser"),
			),
		)
		.orderBy(clubsTable.name, usersTable.name);

	const clubMap = rows.reduce((acc, r) => {
		if (!acc.has(r.id)) {
			acc.set(r.id, { id: r.id, name: r.name, superUsers: [] });
		}
		if (r.superUserName) {
			acc.get(r.id)?.superUsers.push({
				name: r.superUserName,
				phone: r.superUserPhone,
			});
		}
		return acc;
	}, new Map<number, Club>());

	return c.json({ success: true, data: Array.from(clubMap.values()) });
});

export default clubs;
