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

// the pin itself stays on the dashboard so it never sits in an inbox
export const emailDecision = async (
	requester: { name: string; email: string },
	clubName: string,
	decision: "approve" | "reject",
	reviewerName: string,
) => {
	if (!env.EMAIL_USER) {
		return;
	}

	await transporter.sendMail({
		from: `Sandboxx Lock <${env.EMAIL_USER}>`,
		to: requester.email,
		subject:
			decision === "approve"
				? "Your Sandboxx PIN is ready"
				: "Your Sandboxx request was rejected",
		text:
			decision === "approve"
				? [
						`${reviewerName} approved your ${clubName} request.`,
						`Open ${env.FRONTEND_URL} to see your PIN. It is valid for ${env.PIN_VALIDITY_HOURS} hours.`,
					].join("\n")
				: [
						`${reviewerName} rejected your ${clubName} request.`,
						`Call a SuperUser if you think this is a mistake, or send a new request at ${env.FRONTEND_URL}`,
					].join("\n"),
	});
};
