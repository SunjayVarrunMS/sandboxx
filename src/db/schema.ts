import {
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const roles = ["user", "superuser", "admin"] as const;
export type Role = (typeof roles)[number];

export const requestStatuses = [
	"pending",
	"approved",
	"rejected",
	"cancelled",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const lockResults = ["granted", "denied", "locked_out"] as const;
export type LockResult = (typeof lockResults)[number];

export const roleEnum = pgEnum("user_role", roles);
export const requestStatusEnum = pgEnum("request_status", requestStatuses);
export const lockResultEnum = pgEnum("lock_result", lockResults);

export const usersTable = pgTable("users", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	email: varchar({ length: 255 }).notNull().unique(),
	name: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 15 }),
	role: roleEnum().notNull().default("user"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const clubsTable = pgTable("clubs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar({ length: 255 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const clubMembersTable = pgTable(
	"club_members",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		clubId: integer("club_id")
			.notNull()
			.references(() => clubsTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.clubId] })],
);

export const accessRequestsTable = pgTable("access_requests", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	userId: integer("user_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	clubId: integer("club_id")
		.notNull()
		.references(() => clubsTable.id, { onDelete: "cascade" }),
	reason: varchar({ length: 500 }).notNull(),
	status: requestStatusEnum().notNull().default("pending"),
	reviewedBy: integer("reviewed_by").references(() => usersTable.id, {
		onDelete: "set null",
	}),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
	pin: varchar({ length: 6 }),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const lockEventsTable = pgTable("lock_events", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	userId: integer("user_id").references(() => usersTable.id, {
		onDelete: "set null",
	}),
	requestId: integer("request_id").references(() => accessRequestsTable.id, {
		onDelete: "set null",
	}),
	result: lockResultEnum().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
