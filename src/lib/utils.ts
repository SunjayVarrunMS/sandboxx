import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const formatTime = (date: string) =>
	new Date(date).toLocaleString("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});
