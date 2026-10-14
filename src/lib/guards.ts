import { redirect } from "@tanstack/react-router";
import type { Role } from "@/db/schema";

type Context = {
	context: {
		user: { role: Role; phone: string | null } | null;
	};
};

// used as a route's beforeLoad; returning the user makes it non-null in the page
export const requireRole =
	(...roles: Role[]) =>
	<C extends Context>({ context }: C) => {
		if (!context.user) {
			throw redirect({ to: "/login" });
		}
		if (!context.user.phone) {
			throw redirect({ to: "/onboarding" });
		}
		if (roles.length > 0 && !roles.includes(context.user.role)) {
			throw redirect({ to: "/" });
		}
		return { user: context.user as NonNullable<C["context"]["user"]> };
	};
