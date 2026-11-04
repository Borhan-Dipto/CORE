"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive-soft"><AlertTriangle className="size-5 text-destructive" /></div>
      <p className="font-medium">Something went wrong · কিছু একটা ভুল হয়েছে</p>
      <Button variant="outline" onClick={reset}>Try again · আবার চেষ্টা করুন</Button>
    </div>
  );
}
