import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { client, handleErrors, loadData } from "@/lib/api";
import { requireRole } from "@/lib/guards";
import { formatTime } from "@/lib/utils";

const REFRESH_MS = 15_000;

export const Route = createFileRoute("/approvals")({
	beforeLoad: requireRole("superuser", "admin"),
	loader: () => loadData(client.requests.pending.$get()),
	component: ApprovalsPage,
});

function ApprovalsPage() {
	const { user } = Route.useRouteContext();
	const pending = Route.useLoaderData();
	const router = useRouter();

	useEffect(() => {
		const timer = setInterval(() => router.invalidate(), REFRESH_MS);
		return () => clearInterval(timer);
	}, [router]);

	const handleReview = async (id: number, decision: "approve" | "reject") => {
		const res = await client.requests[":id"][":decision"].$post({
			param: { id: id.toString(), decision },
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		toast.success(data.message);
		router.invalidate();
	};

	return (
		<>
			<TopBar user={user} />
			<main className="container mx-auto max-w-4xl p-4 flex flex-col gap-4">
				<h1 className="text-xl font-semibold">Pending requests</h1>
				{pending.length === 0 && (
					<p className="text-sm text-neutral-600">
						No one is waiting right now.
					</p>
				)}
				{pending.map((request) => (
					<Card key={request.id}>
						<CardHeader>
							<CardTitle>{request.name}</CardTitle>
							<CardDescription>
								{request.email}
								{request.phone && (
									<>
										{" · "}
										<a className="underline" href={`tel:${request.phone}`}>
											{request.phone}
										</a>
									</>
								)}
								{" · "}
								{request.clubName} · {formatTime(request.createdAt)}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							<p className="text-sm">{request.reason}</p>
							<div className="flex gap-2">
								<Button onClick={() => handleReview(request.id, "approve")}>
									Approve
								</Button>
								<Button
									variant="outline"
									onClick={() => handleReview(request.id, "reject")}
								>
									Reject
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</main>
		</>
	);
}
