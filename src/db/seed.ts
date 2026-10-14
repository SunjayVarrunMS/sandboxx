import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import env from "@/lib/env";
import { clubMembersTable, clubsTable, usersTable } from "./schema";

// usage: bun run db:seed <admin email> [--demo]
const adminEmail = process.argv[2]?.toLowerCase();
const withDemoData = process.argv.includes("--demo");

if (!adminEmail?.endsWith("@hyderabad.bits-pilani.ac.in")) {
	console.error("usage: bun run db:seed <bits admin email> [--demo]");
	process.exit(1);
}

const db = drizzle({ connection: { connectionString: env.DATABASE_URL } });

await db
	.insert(usersTable)
	.values({
		email: adminEmail,
		name: "Admin",
		phone: "9000000000",
		role: "admin",
	})
	.onConflictDoUpdate({ target: usersTable.email, set: { role: "admin" } });

console.log(`admin: ${adminEmail}`);

if (withDemoData) {
	const demoEmails = [
		"test.superuser@hyderabad.bits-pilani.ac.in",
		"test.user@hyderabad.bits-pilani.ac.in",
	];

	await db
		.insert(clubsTable)
		.values({ name: "Test Club" })
		.onConflictDoNothing();
	await db
		.insert(usersTable)
		.values([
			{
				email: demoEmails[0],
				name: "Test SuperUser",
				phone: "9000000001",
				role: "superuser",
			},
			{
				email: demoEmails[1],
				name: "Test User",
				phone: "9000000002",
				role: "user",
			},
		])
		.onConflictDoNothing();

	const [club] = await db
		.select({ id: clubsTable.id })
		.from(clubsTable)
		.where(eq(clubsTable.name, "Test Club"));
	const users = await db
		.select({ id: usersTable.id })
		.from(usersTable)
		.where(inArray(usersTable.email, demoEmails));

	await db
		.insert(clubMembersTable)
		.values(users.map((u) => ({ userId: u.id, clubId: club.id })))
		.onConflictDoNothing();

	console.log(`demo data: Test Club, ${demoEmails.join(", ")}`);
}

await db.$client.end();
