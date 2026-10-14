import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { client, handleErrors, loadData } from "@/lib/api";
import { requireRole } from "@/lib/guards";
import { formatTime } from "@/lib/utils";

const PENDING_REFRESH_MS = 10_000;

type Club = {
	id: number;
	name: string;
	superUsers: { name: string; phone: string | null }[];
};

type CurrentRequest = {
	id: number;
	clubId: number;
	clubName: string;
	status: string;
	pin: string | null;
	expiresAt: string | null;
	reviewedBy: string | null;
};

export const Route = createFileRoute("/")({
	beforeLoad: requireRole(),
	loader: () =>
		Promise.all([
			loadData(client.requests.current.$get()),
			loadData(client.clubs.$get()),
			loadData(client.requests.inside.$get()),
		]),
	component: Dashboard,
});

function Dashboard() {
	const { user } = Route.useRouteContext();
	const [current, clubs, inside] = Route.useLoaderData();

	const isPending = current?.status === "pending";
	const isActive =
		current?.status === "approved" &&
		current.expiresAt !== null &&
		new Date(current.expiresAt) > new Date();

	// admins can open the door for any club, everyone else only their own
	const myClubs =
		user.role === "admin"
			? clubs
			: clubs.filter((club) => user.clubs.some((c) => c.id === club.id));

	return (
		<>
			<TopBar user={user} />
			<main className="container mx-auto max-w-4xl p-4 flex flex-col gap-6">
				{current && isActive && <PinCard request={current} />}
				{current && isPending && (
					<PendingCard
						request={current}
						club={clubs.find((c) => c.id === current.clubId)}
					/>
				)}
				{!isActive && !isPending && (
					<RequestForm
						clubs={myClubs}
						isTrusted={user.role !== "user"}
						lastRequest={current}
					/>
				)}
				<InsideCard inside={inside} />
			</main>
		</>
	);
}

function PinCard({ request }: { request: CurrentRequest }) {
	const router = useRouter();
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const msLeft = new Date(request.expiresAt ?? 0).getTime() - now;

	useEffect(() => {
		if (msLeft <= 0) {
			router.invalidate();
		}
	}, [msLeft, router]);

	const hours = Math.floor(msLeft / 3_600_000);
	const minutes = Math.floor((msLeft % 3_600_000) / 60_000);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Sandboxx PIN</CardTitle>
				<CardDescription>
					Approved by {request.reviewedBy ?? "a SuperUser"} for{" "}
					{request.clubName}. Type it on the keypad and press #.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<p className="font-mono text-5xl font-semibold tracking-[0.3em]">
					{request.pin}
				</p>
				<p className="text-sm text-neutral-600">
					Valid till {formatTime(request.expiresAt ?? "")} ({hours}h {minutes}m
					left). Don't share it, every entry is logged against you.
				</p>
			</CardContent>
		</Card>
	);
}

function PendingCard({
	request,
	club,
}: {
	request: CurrentRequest;
	club: Club | undefined;
}) {
	const router = useRouter();

	// keep checking so the pin shows up as soon as someone approves
	useEffect(() => {
		const timer = setInterval(() => router.invalidate(), PENDING_REFRESH_MS);
		return () => clearInterval(timer);
	}, [router]);

	const handleCancel = async () => {
		const res = await client.requests[":id"].cancel.$post({
			param: { id: request.id.toString() },
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		router.invalidate();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Waiting for approval</CardTitle>
				<CardDescription>
					Your request was emailed to the {request.clubName} SuperUsers. Your
					PIN will show up here once one of them approves it.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{club && club.superUsers.length > 0 && (
					<div className="flex flex-col gap-1 text-sm">
						<p className="text-neutral-600">In a hurry? Call a SuperUser:</p>
						{club.superUsers.map((s) => (
							<p key={s.name}>
								{s.name}
								{s.phone && (
									<>
										{" "}
										<a className="underline" href={`tel:${s.phone}`}>
											{s.phone}
										</a>
									</>
								)}
							</p>
						))}
					</div>
				)}
				<Button variant="outline" className="self-start" onClick={handleCancel}>
					Cancel request
				</Button>
			</CardContent>
		</Card>
	);
}

function RequestForm({
	clubs,
	isTrusted,
	lastRequest,
}: {
	clubs: Club[];
	isTrusted: boolean;
	lastRequest: CurrentRequest | null;
}) {
	const router = useRouter();
	const clubId = useId();
	const reasonId = useId();

	const handleSubmit = async (formData: FormData) => {
		const res = await client.requests.$post({
			json: {
				clubId: Number(formData.get("clubId")),
				reason: formData.get("reason") as string,
			},
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		toast.success(data.message);
		router.invalidate();
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Enter Sandboxx</CardTitle>
				<CardDescription>
					{isTrusted
						? "You're a SuperUser, so your PIN is generated straight away."
						: "Tell a SuperUser why you need the lab. Once they approve, you get a PIN for the door."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{lastRequest?.status === "rejected" && (
					<p className="mb-4 text-sm text-red-600">
						Your last request was rejected by {lastRequest.reviewedBy}.
					</p>
				)}
				{clubs.length === 0 ? (
					<p className="text-sm text-neutral-600">
						You aren't in any club yet.
					</p>
				) : (
					<form action={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor={clubId}>Club</Label>
							<select
								id={clubId}
								name="clubId"
								className="h-9 rounded-md border bg-white px-3 text-sm"
							>
								{clubs.map((club) => (
									<option key={club.id} value={club.id}>
										{club.name}
									</option>
								))}
							</select>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={reasonId}>Reason</Label>
							<Textarea
								id={reasonId}
								name="reason"
								placeholder="e.g. soldering the motor driver for the rover"
								required
								minLength={3}
								maxLength={500}
							/>
						</div>
						<Button type="submit" className="self-start">
							{isTrusted ? "Get PIN" : "Request access"}
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}

function InsideCard({
	inside,
}: {
	inside: { userId: number | null; name: string; enteredAt: string }[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>In Sandboxx now</CardTitle>
				<CardDescription>
					People who opened the door with a PIN that's still valid.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{inside.length === 0 ? (
					<p className="text-sm text-neutral-600">Nobody right now.</p>
				) : (
					<ul className="flex flex-col gap-1 text-sm">
						{inside.map((person) => (
							<li key={person.userId}>
								{person.name}{" "}
								<span className="text-neutral-500">
									since {formatTime(person.enteredAt)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
