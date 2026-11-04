import Link from "next/link";
import { LogoMark } from "@/components/shell/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="size-10" />
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">Not found · পাওয়া যায়নি</p>
      <Link href="/" className="text-sm font-medium text-brand hover:underline">← CORE</Link>
    </main>
  );
}
