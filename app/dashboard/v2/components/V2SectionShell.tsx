type V2SectionShellProps = {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
};

export function V2SectionShell({ title, description, children }: V2SectionShellProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
