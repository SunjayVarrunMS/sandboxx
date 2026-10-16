import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import {
	accessRequestsTable,
	clubsTable,
	lockEventsTable,
	usersTable,
} from "@/db/schema";
import { type AuthEnv, requireRole } from "./auth";
import { db } from "./db";

const USAGE_DAYS = 14;

const reviewersTable = alias(usersTable, "reviewers");

const logs = new Hono<AuthEnv>()
	.use(requireRole("superuser", "admin"))
	.get("/events", async (c) => {
		const events = await db
			.select({
				id: lockEventsTable.id,
				result: lockEventsTable.result,
				name: usersTable.name,
				email: usersTable.email,
				createdAt: lockEventsTable.createdAt,
			})
			.from(lockEventsTable)
			.leftJoin(usersTable, eq(usersTable.id, lockEventsTable.userId))
			.orderBy(desc(lockEventsTable.createdAt))
			.limit(200);

		return c.json({ success: true, data: events });
	})
	.get("/requests", async (c) => {
		const requests = await db
			.select({
				id: accessRequestsTable.id,
				name: usersTable.name,
				email: usersTable.email,
				clubName: clubsTable.name,
				reason: accessRequestsTable.reason,
				status: accessRequestsTable.status,
				reviewedBy: reviewersTable.name,
				createdAt: accessRequestsTable.createdAt,
			})
			.from(accessRequestsTable)
			.innerJoin(usersTable, eq(usersTable.id, accessRequestsTable.userId))
			.innerJoin(clubsTable, eq(clubsTable.id, accessRequestsTable.clubId))
			.leftJoin(
				reviewersTable,
				eq(reviewersTable.id, accessRequestsTable.reviewedBy),
			)
			.orderBy(desc(accessRequestsTable.createdAt))
			.limit(200);

		return c.json({ success: true, data: requests });
	})
	.get("/usage", async (c) => {
		// days are cut at midnight IST, not UTC
		const day = sql<string>`to_char(${lockEventsTable.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
		const since = new Date(Date.now() - USAGE_DAYS * 24 * 60 * 60 * 1000);

		const usage = await db
			.select({ day, clubName: clubsTable.name, entries: count() })
			.from(lockEventsTable)
			.innerJoin(
				accessRequestsTable,
				eq(accessRequestsTable.id, lockEventsTable.requestId),
			)
			.innerJoin(clubsTable, eq(clubsTable.id, accessRequestsTable.clubId))
			.where(
				and(
					eq(lockEventsTable.result, "granted"),
					gt(lockEventsTable.createdAt, since),
				),
			)
			.groupBy(day, clubsTable.name);

		return c.json({ success: true, data: usage });
	})
	.get("/export", requireRole("admin"), async (c) => {
		const rows = await db
			.select({
				time: lockEventsTable.createdAt,
				result: lockEventsTable.result,
				name: usersTable.name,
				email: usersTable.email,
				club: clubsTable.name,
				reason: accessRequestsTable.reason,
				approvedBy: reviewersTable.name,
			})
			.from(lockEventsTable)
			.leftJoin(usersTable, eq(usersTable.id, lockEventsTable.userId))
			.leftJoin(
				accessRequestsTable,
				eq(accessRequestsTable.id, lockEventsTable.requestId),
			)
			.leftJoin(clubsTable, eq(clubsTable.id, accessRequestsTable.clubId))
			.leftJoin(
				reviewersTable,
				eq(reviewersTable.id, accessRequestsTable.reviewedBy),
			)
			.orderBy(lockEventsTable.createdAt);

		const header = [
			"time",
			"result",
			"name",
			"email",
			"club",
			"reason",
			"approved_by",
		];
		const lines = rows.map((r) =>
			[
				r.time.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
				r.result,
				r.name,
				r.email,
				r.club,
				r.reason,
				r.approvedBy,
			]
				.map(csvCell)
				.join(","),
		);

		c.header("Content-Type", "text/csv");
		c.header(
			"Content-Disposition",
			`attachment; filename="sandboxx-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
		);
		return c.body([header.join(","), ...lines].join("\n"));
	});

export default logs;

// quotes every cell so commas and quotes inside a reason don't break the csv,
// and stops excel from running a reason like "=HYPERLINK(...)" as a formula
const csvCell = (value: string | null) => {
	const text = value ?? "";
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return `"${safe.replaceAll('"', '""')}"`;
};
