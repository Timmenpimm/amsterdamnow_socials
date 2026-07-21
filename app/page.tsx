import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Amsterdam NOW
      </p>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Van WordPress-artikel naar Instagram-carousel, automatisch
      </h1>
      <p className="max-w-md text-base text-muted-foreground">
        Importeer bestaande blogposts, laat AI de sterkste hooks vinden en
        publiceer redactionele carousels zonder handwerk.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/login">Inloggen</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/register">Registreren</Link>
        </Button>
      </div>
    </div>
  );
}
