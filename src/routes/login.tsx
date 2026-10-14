import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import {
	createFileRoute,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { client, handleErrors } from "@/lib/api";

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export const Route = createFileRoute("/login")({
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const router = useRouter();
	const navigate = useNavigate();

	const goHome = async () => {
		await router.invalidate();
		navigate({ to: "/" });
	};

	const handleGoogleLogin = async (credential?: string) => {
		if (!credential) {
			return;
		}
		const res = await client.auth.login.$post({ json: { token: credential } });
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		await goHome();
	};

	const handleDevLogin = async (formData: FormData) => {
		const email = formData.get("email") as string;
		const res = await client.auth["dev-login"].$post({ json: { email } });
		const data = await handleErrors(res);
		if (!data) {
			return;
		}
		await goHome();
	};

	return (
		<div className="min-h-dvh flex items-center justify-center p-4">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-2xl">Sandboxx</CardTitle>
					<CardDescription>
						Sign in with your BITS Hyderabad email to request access to
						Sandboxx.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					{GOOGLE_CLIENT_ID ? (
						<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
							<GoogleLogin
								onSuccess={(res) => handleGoogleLogin(res.credential)}
								onError={() => toast.error("Google sign in failed")}
								hosted_domain="hyderabad.bits-pilani.ac.in"
							/>
						</GoogleOAuthProvider>
					) : (
						<p className="text-sm text-neutral-500">
							Google sign in is not configured. Set VITE_GOOGLE_CLIENT_ID in
							.env.
						</p>
					)}
					{import.meta.env.DEV && (
						<form action={handleDevLogin} className="flex flex-col gap-2">
							<p className="text-xs text-neutral-500">
								Dev login (only works when DEV_LOGIN=true)
							</p>
							<Input name="email" type="email" placeholder="Email" required />
							<Button type="submit" variant="outline">
								Log in as this user
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
