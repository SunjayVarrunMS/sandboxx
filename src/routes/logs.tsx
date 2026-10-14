import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Route = createFileRoute("/logs")({
	beforeLoad: requireRole("superuser", "admin"),
	loader: () =>
		Promise.all([
			loadData(client.logs.events.$get()),
			loadData(client.logs.requests.$get()),
		]),
	component: LogsPage,
});

function LogsPage() {
	const { user } = Route.useRouteContext();
	const [events, requests] = Route.useLoaderData();

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
