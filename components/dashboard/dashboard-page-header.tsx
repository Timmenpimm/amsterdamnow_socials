interface DashboardPageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function DashboardPageHeader({
  title,
  description,
  action,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
