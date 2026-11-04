import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-semibold">404</p>
      <p className="text-muted">Not found · পাওয়া যায়নি</p>
      <Link href="/" className="btn-ghost">← CORE</Link>
    </main>
  );
}
