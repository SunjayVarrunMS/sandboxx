import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/privacy")({
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<div className="min-h-dvh flex justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader>
					<CardTitle className="text-2xl">Privacy policy</CardTitle>
					<CardDescription>
						Sandboxx Lock controls the door of Sandboxx, the BITS Hyderabad
						hardware clubs' workspace.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 text-sm">
					<section className="flex flex-col gap-1">
						<h2 className="font-semibold">What we store</h2>
						<ul className="list-disc pl-5">
							<li>Your BITS email and name, from Google sign in</li>
							<li>Your phone number, if you give it</li>
							<li>
								Your access requests: the club, your reason, the decision and
								the PIN
							</li>
							<li>
								Access logs: when a PIN was used at the lock and whether it
								worked
							</li>
						</ul>
						<p>
							We only use Google sign in to know who you are. We don't read
							anything else from your Google account.
						</p>
					</section>
					<section className="flex flex-col gap-1">
						<h2 className="font-semibold">Who sees it</h2>
						<p>
							The SuperUsers of the club you ask for access see your request and
							get an email about it. Sandboxx admins can see all requests and
							access logs. SuperUser phone numbers are shown to users so they
							can be contacted.
						</p>
						<p>
							Nothing is sold or shared for ads. The data lives on our hosting
							(Vercel) and database (Neon).
						</p>
					</section>
					<section className="flex flex-col gap-1">
						<h2 className="font-semibold">Contact</h2>
						<p>
							For questions or to have your data removed, email{" "}
							<a href="mailto:sunjayms@gmail.com" className="underline">
								sunjayms@gmail.com
							</a>
							.
						</p>
					</section>
					<Link to="/login" className="underline text-neutral-500">
						Back to sign in
					</Link>
				</CardContent>
			</Card>
		</div>
	);
}
