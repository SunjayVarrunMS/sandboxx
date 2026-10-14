import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

// same as zValidator but failures use our { success, error } shape
export const validate = <
	Target extends keyof ValidationTargets,
	Schema extends z.ZodType,
>(
	target: Target,
	schema: Schema,
) =>
	zValidator(target, schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					success: false as const,
					error: { message: z.prettifyError(result.error) },
				},
				400,
			);
		}
	});
