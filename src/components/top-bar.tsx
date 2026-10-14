import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/db/schema";
import { client } from "@/lib/api";

export function TopBar({ user }: { user: { name: string; role: Role } }) {
	const router = useRouter();
	const navigate = useNavigate();

	const handleLogout = async () => {
		await client.auth.logout.$post();
		await router.invalidate();
		navigate({ to: "/login" });
	};

	const isReviewer = user.role === "superuser" || user.role === "admin";

	return (
		<header className="border-b bg-white">
			<div className="container mx-auto max-w-4xl px-4 h-14 flex items-center gap-4">
				<Link to="/" className="font-semibold">
					Sandboxx
				</Link>
				<nav className="flex gap-3 text-sm text-neutral-600">
					<Link to="/" activeProps={{ className: "text-black" }}>
						Home
					</Link>
					{isReviewer && (
						<>
							<Link to="/approvals" activeProps={{ className: "text-black" }}>
								Approvals
							</Link>
							<Link to="/logs" activeProps={{ className: "text-black" }}>
								Logs
							</Link>
						</>
					)}
					{user.role === "admin" && (
						<Link to="/admin" activeProps={{ className: "text-black" }}>
							Admin
						</Link>
					)}
				</nav>
				<div className="ml-auto flex items-center gap-2">
					<span className="hidden sm:inline text-sm text-neutral-600">
						{user.name}
					</span>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Log out"
						onClick={handleLogout}
					>
						<LogOut />
					</Button>
				</div>
			</div>
		</header>
	);
}
