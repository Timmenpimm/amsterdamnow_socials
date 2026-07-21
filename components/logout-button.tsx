"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(className)}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut />
      Log out
    </Button>
  );
}
