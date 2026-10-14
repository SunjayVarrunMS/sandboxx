import { redirect } from "@tanstack/react-router";
import { hc } from "hono/client";
import { toast } from "sonner";
import type { AppType } from "@/api";

export const client = hc<AppType>("/").api;

type ApiBody =
	| { success: true; data: unknown }
	| { success: false; error: { message: string } };

type ApiResponse = { status: number; json(): Promise<ApiBody> };

// pulls the type of `data` out of the success branch of a response
type Data<R> = R extends { json(): Promise<infer Body> }
	? Body extends { success: true; data: infer D }
		? D
		: never
	: never;

// for loaders: returns the data or sends the user to /login
export const loadData = async <R extends ApiResponse>(
	resOrPromise: R | Promise<R>,
): Promise<Data<R>> => {
	const res = await resOrPromise;
	const body = await res.json();
	if (body.success) {
		return body.data as Data<R>;
	}
	if (res.status === 401) {
		throw redirect({ to: "/login" });
	}
	throw new Error(body.error.message);
};

// for buttons and forms: shows the error as a toast and returns null
export const handleErrors = async <R extends ApiResponse>(
	res: R,
): Promise<Data<R> | null> => {
	const body = await res.json();
	if (!body.success) {
		toast.error(body.error.message);
		return null;
	}
	return body.data as Data<R>;
};
