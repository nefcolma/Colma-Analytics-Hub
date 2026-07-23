"use client";

/** Small shared UI primitives: cards, badges, buttons, skeletons, states. */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      Demo data
    </span>
  );
}

export function Chip({
  tone,
  children,
}: {
  tone: "positive" | "negative" | "neutral" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "positive"
      ? "bg-positive-soft text-positive"
      : tone === "negative"
        ? "bg-negative-soft text-negative"
        : tone === "warn"
          ? "bg-accent-soft text-accent-strong"
          : "bg-paper text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm";
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-strong disabled:hover:bg-accent",
    secondary:
      "border border-line-strong bg-surface text-ink hover:border-ink/40 disabled:hover:border-line-strong",
    ghost: "text-ink-3 hover:bg-paper",
    danger: "border border-negative/40 bg-surface text-negative hover:bg-negative-soft",
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-line/70 ${className}`} />;
}

export function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-28" />
        </Card>
      ))}
    </div>
  );
}

export function BlockSkeleton({ h = "h-72" }: { h?: string }) {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-40" />
      <Skeleton className={`mt-4 w-full ${h}`} />
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h3 className="font-display text-lg">{title}</h3>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  extra,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 border-negative/30 px-6 py-10 text-center">
      <h3 className="font-display text-lg text-negative">{title}</h3>
      <p className="max-w-md text-sm text-muted">{body}</p>
      <div className="mt-3 flex items-center gap-2">
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {extra}
      </div>
    </Card>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5.5 w-10 items-center rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-line-strong"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
