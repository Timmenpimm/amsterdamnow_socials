import { FileText, Globe } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PostsArticlesTable } from "@/components/dashboard/posts-articles-table";
import { PostsImportButton } from "@/components/dashboard/posts-import-button";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

export default async function PostsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const connection = await db.wordPressConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!connection) {
    return (
      <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
        <DashboardPageHeader
          title="Posts"
          description="Geïmporteerde WordPress-artikelen die klaar zijn om om te zetten naar een carousel."
        />

        <EmptyState
          icon={Globe}
          title="Nog geen WordPress-website verbonden"
          description="Verbind eerst een WordPress-website via Settings om artikelen te kunnen importeren."
          action={
            <Button asChild>
              <Link href="/dashboard/settings">Naar Settings</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const articles = await db.article.findMany({
    where: { connectionId: connection.id },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <DashboardPageHeader
        title="Posts"
        description="Geïmporteerde WordPress-artikelen die klaar zijn om om te zetten naar een carousel."
        action={<PostsImportButton connectionId={connection.id} />}
      />

      {articles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nog geen artikelen geïmporteerd"
          description={`Klik op "Importeer nieuwste posts" om de laatste artikelen van ${connection.url} op te halen.`}
          action={
            <PostsImportButton connectionId={connection.id} />
          }
        />
      ) : (
        <PostsArticlesTable
          articles={articles.map((article) => ({
            id: article.id,
            title: article.title,
            imageUrl: article.imageUrl,
            categories: article.categories,
            status: article.status,
            publishedAt: article.publishedAt,
          }))}
        />
      )}
    </div>
  );
}
