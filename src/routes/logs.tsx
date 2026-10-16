import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { client, loadData } from "@/lib/api";
import { requireRole } from "@/lib/guards";
import { formatTime } from "@/lib/utils";

const USAGE_DAYS = 14;

type UsageRow = { day: string; clubName: string; entries: number };

export const Route = createFileRoute("/logs")({
	beforeLoad: requireRole("superuser", "admin"),
	loader: () =>
		Promise.all([
			loadData(client.logs.events.$get()),
			loadData(client.logs.requests.$get()),
			loadData(client.logs.usage.$get()),
		]),
	component: LogsPage,
});

function LogsPage() {
	const { user } = Route.useRouteContext();
	const [events, requests, usage] = Route.useLoaderData();

	return (
		<>
			<TopBar user={user} />
			<main className="container mx-auto max-w-4xl p-4 flex flex-col gap-6">
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-semibold">Logs</h1>
					{user.role === "admin" && (
						<Button variant="outline" asChild>
							<a href="/api/logs/export">Download CSV</a>
						</Button>
					)}
				</div>
				<UsageCard usage={usage} />
				<Card>
					<CardHeader>
						<CardTitle>Door</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Time</TableHead>
									<TableHead>Result</TableHead>
									<TableHead>Person</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{events.map((event) => (
									<TableRow key={event.id}>
										<TableCell>{formatTime(event.createdAt)}</TableCell>
										<TableCell>
											<Badge
												variant={
													event.result === "granted" ? "default" : "destructive"
												}
											>
												{event.result.replace("_", " ")}
											</Badge>
										</TableCell>
										<TableCell>
											{event.name ??
												(event.result === "locked_out"
													? "Keypad locked"
													: "Wrong PIN")}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Requests</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Time</TableHead>
									<TableHead>Person</TableHead>
									<TableHead>Club</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{requests.map((request) => (
									<TableRow key={request.id}>
										<TableCell>{formatTime(request.createdAt)}</TableCell>
										<TableCell>{request.name}</TableCell>
										<TableCell>{request.clubName}</TableCell>
										<TableCell className="max-w-64 whitespace-normal">
											{request.reason}
										</TableCell>
										<TableCell>
											{request.status}
											{request.reviewedBy && (
												<span className="text-neutral-500">
													{" "}
													by {request.reviewedBy}
												</span>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</main>
		</>
	);
}

// last 14 days as YYYY-MM-DD in IST, oldest first, to match the api
const lastDays = () =>
	Array.from({ length: USAGE_DAYS }, (_, i) =>
		new Date(
			Date.now() - (USAGE_DAYS - 1 - i) * 24 * 60 * 60 * 1000,
		).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
	);

function UsageCard({ usage }: { usage: UsageRow[] }) {
	const days = lastDays();
	const clubs = [...new Set(usage.map((u) => u.clubName))].sort();
	const max = Math.max(1, ...usage.map((u) => u.entries));

	const entriesOn = (clubName: string, day: string) =>
		usage.find((u) => u.clubName === clubName && u.day === day)?.entries ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Usage</CardTitle>
				<CardDescription>
					Door openings per club per day, last {USAGE_DAYS} days.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{clubs.length === 0 ? (
					<p className="text-sm text-neutral-600">
						No one has opened the door in the last {USAGE_DAYS} days.
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{clubs.map((club) => (
							<div key={club} className="flex items-end gap-3">
								<span className="w-28 shrink-0 truncate text-sm">{club}</span>
								<div className="flex h-10 flex-1 items-end gap-0.5 border-b border-neutral-200">
									{days.map((day) => {
										const entries = entriesOn(club, day);
										return (
											<div
												key={day}
												title={`${day}: ${entries} ${entries === 1 ? "entry" : "entries"}`}
												className="flex h-full flex-1 items-end hover:bg-neutral-100"
											>
												{entries > 0 && (
													<div
														className="w-full rounded-t-sm bg-neutral-800"
														style={{ height: `${(entries / max) * 100}%` }}
													/>
												)}
											</div>
										);
									})}
								</div>
								<span className="w-8 shrink-0 text-right text-sm text-neutral-600">
									{days.reduce((sum, day) => sum + entriesOn(club, day), 0)}
								</span>
							</div>
						))}
						<div className="flex justify-between pl-31 pr-11 text-xs text-neutral-500">
							<span>{days[0].slice(5)}</span>
							<span>today</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
