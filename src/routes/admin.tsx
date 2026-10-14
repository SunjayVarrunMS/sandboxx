import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { client, handleErrors, loadData } from "@/lib/api";
import { requireRole } from "@/lib/guards";

type Club = { id: number; name: string };

export const Route = createFileRoute("/admin")({
	beforeLoad: requireRole("admin"),
	loader: () =>
		Promise.all([
			loadData(client.clubs.$get()),
			loadData(client.admin.superusers.$get()),
		]),
	component: AdminPage,
});

function AdminPage() {
	const { user } = Route.useRouteContext();
	const [clubs, superUsers] = Route.useLoaderData();

	return (
		<>
			<TopBar user={user} />
			<main className="container mx-auto max-w-4xl p-4 flex flex-col gap-6">
				<h1 className="text-xl font-semibold">Admin</h1>
				<ClubsCard clubs={clubs} />
				<SuperUsersCard clubs={clubs} superUsers={superUsers} />
				<WipeCard />
			</main>
		</>
	);
}

function ClubsCard({ clubs }: { clubs: Club[] }) {
	const router = useRouter();

	const handleAdd = async (formData: FormData) => {
		const res = await client.admin.clubs.$post({
			json: { name: formData.get("name") as string },
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		router.invalidate();
	};

	const handleDelete = async (club: Club) => {
		if (!confirm(`Delete ${club.name}? Its requests are deleted with it.`)) {
			return;
		}
		const res = await client.admin.clubs[":id"].delete.$post({
			param: { id: club.id.toString() },
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
				<CardTitle>Clubs</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<ul className="flex flex-col gap-2">
					{clubs.map((club) => (
						<li key={club.id} className="flex items-center justify-between">
							<span>{club.name}</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleDelete(club)}
							>
								Delete
							</Button>
						</li>
					))}
				</ul>
				<form action={handleAdd} className="flex gap-2">
					<Input name="name" placeholder="Club name" required />
					<Button type="submit">Add</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function SuperUsersCard({
	clubs,
	superUsers,
}: {
	clubs: Club[];
	superUsers: {
		id: number;
		name: string;
		email: string;
		phone: string | null;
		clubs: string[];
	}[];
}) {
	const router = useRouter();
	const emailId = useId();
	const nameId = useId();
	const phoneId = useId();
	const [clubIds, setClubIds] = useState<number[]>([]);

	const handleAdd = async (formData: FormData) => {
		const res = await client.admin.superusers.$post({
			json: {
				email: formData.get("email") as string,
				name: formData.get("name") as string,
				phone: formData.get("phone") as string,
				clubIds,
			},
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		toast.success(data.message);
		setClubIds([]);
		router.invalidate();
	};

	const handleRemove = async (id: number) => {
		const res = await client.admin.superusers[":id"].remove.$post({
			param: { id: id.toString() },
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
				<CardTitle>SuperUsers</CardTitle>
				<CardDescription>
					2nd years (3rd years by exception) who approve requests for their
					clubs.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<ul className="flex flex-col gap-2 text-sm">
					{superUsers.map((s) => (
						<li key={s.id} className="flex items-center justify-between gap-2">
							<span>
								{s.name}{" "}
								<span className="text-neutral-500">
									{s.email} · {s.phone} · {s.clubs.join(", ")}
								</span>
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleRemove(s.id)}
							>
								Remove
							</Button>
						</li>
					))}
				</ul>
				<form action={handleAdd} className="flex flex-col gap-3">
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor={emailId}>BITS email</Label>
							<Input id={emailId} name="email" type="email" required />
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={nameId}>Name</Label>
							<Input id={nameId} name="name" required />
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={phoneId}>Phone</Label>
							<Input id={phoneId} name="phone" inputMode="numeric" required />
						</div>
					</div>
					<div className="flex flex-wrap gap-4">
						{clubs.map((club) => (
							<Label key={club.id} className="font-normal">
								<Checkbox
									checked={clubIds.includes(club.id)}
									onCheckedChange={(checked) =>
										setClubIds((prev) =>
											checked === true
												? [...prev, club.id]
												: prev.filter((id) => id !== club.id),
										)
									}
								/>
								{club.name}
							</Label>
						))}
					</div>
					<Button type="submit" className="self-start">
						Add SuperUser
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

function WipeCard() {
	const router = useRouter();

	const handleWipe = async (formData: FormData) => {
		const res = await client.admin.wipe.$post({
			json: { confirm: formData.get("confirm") as "WIPE" },
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		toast.success(data.message);
		router.invalidate();
	};

	return (
		<Card className="border-red-200">
			<CardHeader>
				<CardTitle>New academic year</CardTitle>
				<CardDescription>
					Deletes every user, SuperUser, request and log. Admins and clubs stay.
					Download the CSV from the Logs page first.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleWipe} className="flex gap-2">
					<Input name="confirm" placeholder='Type "WIPE" to confirm' required />
					<Button type="submit" variant="destructive">
						Wipe
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
