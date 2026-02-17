// app/login/page.tsx
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  // In Next 15, this is a Promise
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const nextParam = Array.isArray(sp?.next) ? sp.next[0] : sp?.next;
  const next = nextParam ?? "/dashboard";

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
        <LoginForm next={next} />
        <p className="mt-4 text-xs text-gray-500">
          You’ll be redirected to: <span className="font-mono">{next}</span>
        </p>
      </div>
    </div>
  );
}
