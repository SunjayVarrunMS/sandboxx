import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";
import {
	accessRequestsTable,
	clubMembersTable,
	clubsTable,
	lockEventsTable,
	usersTable,
} from "@/db/schema";
import env from "@/lib/env";
import { type AuthEnv, requireRole, type User } from "./auth";
import { db } from "./db";
import { emailSuperUsers } from "./email";
import { validate } from "./validate";

const idParam = z.object({ id: z.coerce.number().int().positive() });

const reviewersTable = alias(usersTable, "reviewers");

const requests = new Hono<AuthEnv>()
	.get("/current", async (c) => {
		const user = c.var.user;

		const [request] = await db
			.select({
				id: accessRequestsTable.id,
				clubId: accessRequestsTable.clubId,
				clubName: clubsTable.name,
				reason: accessRequestsTable.reason,
				status: accessRequestsTable.status,
				pin: accessRequestsTable.pin,
				expiresAt: accessRequestsTable.expiresAt,
				reviewedBy: reviewersTable.name,
				createdAt: accessRequestsTable.createdAt,
			})
			.from(accessRequestsTable)
			.innerJoin(clubsTable, eq(clubsTable.id, accessRequestsTable.clubId))
			.leftJoin(
				reviewersTable,
				eq(reviewersTable.id, accessRequestsTable.reviewedBy),
			)
			.where(eq(accessRequestsTable.userId, user.id))
			.orderBy(desc(accessRequestsTable.createdAt))
			.limit(1);

		return c.json({ success: true, data: request ?? null });
	})
	.post(
		"/",
		validate(
			"json",
			z.object({
				clubId: z.number().int().positive(),
				reason: z.string().trim().min(3).max(500),
			}),
		),
		async (c) => {
			const user = c.var.user;
			const { clubId, reason } = c.req.valid("json");

			if (!user.phone) {
				return c.json(
					{ success: false, error: { message: "Complete your profile first" } },
					400,
				);
			}

			if (user.role !== "admin" && !(await isClubMember(user.id, clubId))) {
				return c.json(
					{ success: false, error: { message: "You are not in this club" } },
					403,
				);
			}

			const [open] = await db
				.select({ id: accessRequestsTable.id })
				.from(accessRequestsTable)
				.where(
					and(
						eq(accessRequestsTable.userId, user.id),
						or(
							eq(accessRequestsTable.status, "pending"),
							and(
								eq(accessRequestsTable.status, "approved"),
								gt(accessRequestsTable.expiresAt, new Date()),
							),
						),
					),
				)
				.limit(1);

			if (open) {
				return c.json(
					{
						success: false,
						error: { message: "You already have an open request" },
					},
					409,
				);
			}

			// superusers and admins are trusted, so their requests approve themselves
			if (user.role !== "user") {
				await db.insert(accessRequestsTable).values({
					userId: user.id,
					clubId,
					reason,
					...(await approval(user)),
				});
				return c.json({ success: true, data: { message: "PIN generated" } });
			}

			await db
				.insert(accessRequestsTable)
				.values({ userId: user.id, clubId, reason });

			emailSuperUsers(clubId, user, reason).catch((err) =>
				console.error("failed to email superusers", err),
			);

			return c.json({ success: true, data: { message: "Request sent" } });
		},
	)
	.post("/:id/cancel", validate("param", idParam), async (c) => {
		const { id } = c.req.valid("param");

		const res = await db
			.update(accessRequestsTable)
			.set({ status: "cancelled" })
			.where(
				and(
					eq(accessRequestsTable.id, id),
					eq(accessRequestsTable.userId, c.var.user.id),
					eq(accessRequestsTable.status, "pending"),
				),
			);

		if (res.rowCount !== 1) {
			return c.json(
				{ success: false, error: { message: "Request not found" } },
				404,
			);
		}

		return c.json({ success: true, data: { message: "Request cancelled" } });
	})
	.get("/inside", async (c) => {
		const rows = await db
			.selectDistinctOn([lockEventsTable.userId], {
				userId: lockEventsTable.userId,
				name: usersTable.name,
				enteredAt: lockEventsTable.createdAt,
			})
			.from(lockEventsTable)
			.innerJoin(usersTable, eq(usersTable.id, lockEventsTable.userId))
			.innerJoin(
				accessRequestsTable,
				eq(accessRequestsTable.id, lockEventsTable.requestId),
			)
			.where(
				and(
					eq(lockEventsTable.result, "granted"),
					gt(accessRequestsTable.expiresAt, new Date()),
				),
			)
			.orderBy(lockEventsTable.userId, desc(lockEventsTable.createdAt));

		return c.json({ success: true, data: rows });
	})
	.get("/pending", requireRole("superuser", "admin"), async (c) => {
		const user = c.var.user;

		const clubIds =
			user.role === "admin"
				? undefined
				: await db
						.select({ clubId: clubMembersTable.clubId })
						.from(clubMembersTable)
						.where(eq(clubMembersTable.userId, user.id))
						.then((rows) => rows.map((r) => r.clubId));

		if (clubIds?.length === 0) {
			return c.json({ success: true, data: [] });
		}

		const pending = await db
			.select({
				id: accessRequestsTable.id,
				name: usersTable.name,
				email: usersTable.email,
				phone: usersTable.phone,
				clubName: clubsTable.name,
				reason: accessRequestsTable.reason,
				createdAt: accessRequestsTable.createdAt,
			})
			.from(accessRequestsTable)
			.innerJoin(usersTable, eq(usersTable.id, accessRequestsTable.userId))
			.innerJoin(clubsTable, eq(clubsTable.id, accessRequestsTable.clubId))
			.where(
				and(
					eq(accessRequestsTable.status, "pending"),
					clubIds ? inArray(accessRequestsTable.clubId, clubIds) : undefined,
				),
			)
			.orderBy(accessRequestsTable.createdAt);

		return c.json({ success: true, data: pending });
	})
	.post(
		"/:id/:decision",
		requireRole("superuser", "admin"),
		validate(
			"param",
			idParam.extend({ decision: z.enum(["approve", "reject"]) }),
		),
		async (c) => {
			const { id, decision } = c.req.valid("param");
			const error = await review(c.var.user, id, decision);

			if (error) {
				return c.json(
					{ success: false, error: { message: error.message } },
					error.status,
				);
			}

			return c.json({
				success: true,
				data: {
					message:
						decision === "approve" ? "Request approved" : "Request rejected",
				},
			});
		},
	);

export default requests;

const isClubMember = async (userId: number, clubId: number) => {
	const [member] = await db
		.select({ userId: clubMembersTable.userId })
		.from(clubMembersTable)
		.where(
			and(
				eq(clubMembersTable.userId, userId),
				eq(clubMembersTable.clubId, clubId),
			),
		)
		.limit(1);
	return member !== undefined;
};

// a pin can't be reused while another approved request still holds it
const generatePin = async () => {
	for (let i = 0; i < 10; i++) {
		const pin = randomInt(0, 1_000_000).toString().padStart(6, "0");
		const [clash] = await db
			.select({ id: accessRequestsTable.id })
			.from(accessRequestsTable)
			.where(
				and(
					eq(accessRequestsTable.pin, pin),
					eq(accessRequestsTable.status, "approved"),
					gt(accessRequestsTable.expiresAt, new Date()),
				),
			)
			.limit(1);
		if (!clash) {
			return pin;
		}
	}
	throw new Error("Could not generate a unique PIN");
};

const approval = async (reviewer: User) => {
	const now = new Date();
	return {
		status: "approved" as const,
		pin: await generatePin(),
		expiresAt: new Date(now.getTime() + env.PIN_VALIDITY_HOURS * 3600 * 1000),
		reviewedBy: reviewer.id,
		reviewedAt: now,
	};
};

const review = async (
	reviewer: User,
	requestId: number,
	decision: "approve" | "reject",
) => {
	const [request] = await db
		.select({ clubId: accessRequestsTable.clubId })
		.from(accessRequestsTable)
		.where(
			and(
				eq(accessRequestsTable.id, requestId),
				eq(accessRequestsTable.status, "pending"),
			),
		)
		.limit(1);

	if (!request) {
		return { message: "Request not found", status: 404 as const };
	}

	if (
		reviewer.role !== "admin" &&
		!(await isClubMember(reviewer.id, request.clubId))
	) {
		return {
			message: "This request is for another club",
			status: 403 as const,
		};
	}

	const changes =
		decision === "approve"
			? await approval(reviewer)
			: {
					status: "rejected" as const,
					reviewedBy: reviewer.id,
					reviewedAt: new Date(),
				};

	// the status check stops two superusers reviewing the same request
	const res = await db
		.update(accessRequestsTable)
		.set(changes)
		.where(
			and(
				eq(accessRequestsTable.id, requestId),
				eq(accessRequestsTable.status, "pending"),
			),
		);

	if (res.rowCount !== 1) {
		return { message: "Request already reviewed", status: 409 as const };
	}

	return null;
};
