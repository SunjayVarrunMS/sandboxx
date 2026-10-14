import "dotenv/config";
import { z } from "zod";

const serverSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	DB_HOST: z.string().min(1),
	PGPORT: z.coerce.number().int().positive().default(5432),
	POSTGRES_USER: z.string().min(1),
	POSTGRES_PASSWORD: z.string().min(1),
	POSTGRES_DB: z.string().min(1),
	FRONTEND_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	LOCK_API_KEY: z.string().min(32),
	PIN_VALIDITY_HOURS: z.coerce.number().int().positive().default(12),
	GOOGLE_CLIENT_ID: z.string().default(""),
	EMAIL_USER: z.string().default(""),
	EMAIL_PASS: z.string().default(""),
	DEV_LOGIN: z.stringbool().default(false),
});

const parsed = serverSchema.parse(process.env, {
	error: () =>
		"invalid/missing environment variables, please check .env.example for a list of required variables",
});

export const DATABASE_URL = `postgres://${parsed.POSTGRES_USER}:${parsed.POSTGRES_PASSWORD}@${parsed.DB_HOST}:${parsed.PGPORT}/${parsed.POSTGRES_DB}`;
export const PROD = parsed.NODE_ENV === "production";

export default {
	DATABASE_URL,
	PROD,
	...parsed,
};
