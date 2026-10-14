import { and, eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { clubMembersTable, usersTable } from "@/db/schema";
import env from "@/lib/env";
import { db } from "./db";

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: env.EMAIL_USER,
		pass: env.EMAIL_PASS,
	},
});

export const emailSuperUsers = async (
	clubId: number,
	requester: { name: string; email: string; phone: string | null },
	reason: string,
) => {
	if (!env.EMAIL_USER) {
		return;
	}

	const superUsers = await db
		.select({ email: usersTable.email })
		.from(clubMembersTable)
		.innerJoin(usersTable, eq(usersTable.id, clubMembersTable.userId))
		.where(
			and(
				eq(clubMembersTable.clubId, clubId),
				eq(usersTable.role, "superuser"),
			),
		);

	if (superUsers.length === 0) {
		return;
	}

	await transporter.sendMail({
		from: `Sandboxx Lock <${env.EMAIL_USER}>`,
		bcc: superUsers.map((s) => s.email),
		subject: `Sandboxx access request from ${requester.name}`,
		text: [
			`${requester.name} (${requester.email}, ${requester.phone ?? "no phone"}) wants to enter Sandboxx.`,
			`Reason: ${reason}`,
			"",
			`Approve or reject: ${env.FRONTEND_URL}/approvals`,
		].join("\n"),
	});
};
