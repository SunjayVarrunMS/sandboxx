import {
	createFileRoute,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useId, useState } from "react";
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

export const Route = createFileRoute("/onboarding")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw redirect({ to: "/login" });
		}
		return { user: context.user };
	},
	loader: () => loadData(client.clubs.$get()),
	component: OnboardingPage,
});

function OnboardingPage() {
	const { user } = Route.useRouteContext();
	const clubs = Route.useLoaderData();
	const router = useRouter();
	const navigate = useNavigate();
	const nameId = useId();
	const phoneId = useId();

	const [clubIds, setClubIds] = useState(user.clubs.map((c) => c.id));
	const canPickClubs = user.role === "user";

	const toggleClub = (id: number, checked: boolean) => {
		setClubIds((prev) =>
			checked ? [...prev, id] : prev.filter((clubId) => clubId !== id),
		);
	};

	const handleSubmit = async (formData: FormData) => {
		const res = await client.me.profile.$post({
			json: {
				name: formData.get("name") as string,
				phone: formData.get("phone") as string,
				clubIds,
			},
		});
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		await router.invalidate();
		navigate({ to: "/" });
	};

	return (
		<div className="min-h-dvh flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Your profile</CardTitle>
					<CardDescription>
						SuperUsers see this when you ask for access.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form action={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor={nameId}>Name</Label>
							<Input
								id={nameId}
								name="name"
								defaultValue={user.name}
								required
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor={phoneId}>Phone</Label>
							<Input
								id={phoneId}
								name="phone"
								inputMode="numeric"
								placeholder="10 digit mobile number"
								defaultValue={user.phone ?? ""}
								required
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label>Clubs</Label>
							{canPickClubs ? (
								clubs.map((club) => (
									<Label key={club.id} className="font-normal">
										<Checkbox
											checked={clubIds.includes(club.id)}
											onCheckedChange={(checked) =>
												toggleClub(club.id, checked === true)
											}
										/>
										{club.name}
									</Label>
								))
							) : (
								<p className="text-sm text-neutral-600">
									{user.clubs.map((c) => c.name).join(", ") ||
										"Set by the admin"}
								</p>
							)}
						</div>
						<Button type="submit">Save</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
