"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionCompany } from "@/lib/types";

export function SessionMenu({ company }: { company: SessionCompany }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
        <Building2 className="size-3.5" aria-hidden />
        {company.name}
      </span>
      <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
        <LogOut className="size-3.5" aria-hidden />
        Salir
      </Button>
    </div>
  );
}
