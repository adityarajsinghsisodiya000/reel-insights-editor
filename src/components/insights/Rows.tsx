import { TimerReset } from "lucide-react";
import { BookmarkIcon, CommentIcon, HeartIcon, RepostIcon, ShareIcon } from "./icons";
import type { ImpactRow as ImpactRowType } from "@/lib/insights-data";
import { Editable } from "./Editable";

export function LabelValueRow({
  label,
  value,
  onLabel,
  onValue,
}: {
  label: string;
  value: string;
  onLabel: (v: string) => void;
  onValue: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <Editable value={label} onChange={onLabel} label="Label">
        <span className="text-[16px] text-ig-text">{label}</span>
      </Editable>
      <Editable value={value} onChange={onValue} kind="number" label="Value">
        <span className="text-[16px] text-ig-text">{value}</span>
      </Editable>
    </div>
  );
}

const impactIcons = {
  skip: TimerReset,
  share: ShareIcon,
  like: HeartIcon,
  save: BookmarkIcon,
  repost: RepostIcon,
  comment: CommentIcon,
} as const;

export function ImpactRow({
  row,
  onLabel,
  onValue,
  onTrend,
}: {
  row: ImpactRowType;
  onLabel: (v: string) => void;
  onValue: (v: string) => void;
  onTrend: (v: string) => void;
}) {
  const Icon = impactIcons[row.icon] ?? HeartIcon;
  return (
    <div className="flex items-center gap-4 py-[14px]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ig-card">
        <Icon className="h-[22px] w-[22px] text-ig-text" strokeWidth={1.8} />
      </span>
      <Editable value={row.label} onChange={onLabel} label="Metric name">
        <span className="flex-1 text-[16px] text-ig-text">{row.label}</span>
      </Editable>
      <div className="ml-auto shrink-0 text-right">
        <Editable value={row.value} onChange={onValue} kind="number" label="Rate">
          <span className="block text-[16px] font-bold text-ig-text">{row.value}</span>
        </Editable>
        <div>
          <Editable value={row.trend} onChange={onTrend} label="Status">
            <span className={`block text-[13px] ${row.trend === "Typical" ? "text-ig-dim" : "text-ig-green"}`}>
              {row.trend}
            </span>
          </Editable>
        </div>
      </div>
    </div>
  );
}

export function ProgressRow({
  name,
  percentage,
  onName,
  onPercentage,
}: {
  name: string;
  percentage: number;
  onName: (v: string) => void;
  onPercentage: (v: number) => void;
}) {
  return (
    <div className="py-2">
      <Editable value={name} onChange={onName} label="Name">
        <span className="text-[15px] text-ig-text">{name}</span>
      </Editable>
      <div className="mt-2 flex items-center gap-4">
        <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-ig-track">
          <div
            className="h-full rounded-full bg-ig-magenta transition-all duration-200"
            style={{ width: `${Math.max(1, Math.min(100, percentage))}%` }}
          />
        </div>
        <Editable
          value={percentage}
          onChange={(v) => onPercentage(Number(v) || 0)}
          kind="percent"
          label="Percentage (0-100)"
        >
          <span className="w-14 shrink-0 text-right text-[15px] font-semibold text-ig-text">
            {percentage}%
          </span>
        </Editable>
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  onChange,
  subtitle,
  onSubtitle,
  right,
  info = true,
}: {
  title: string;
  onChange: (v: string) => void;
  subtitle?: string;
  onSubtitle?: (v: string) => void;
  right?: React.ReactNode;
  info?: boolean;
}) {
  return (
    <div className="mb-2 mt-7 first:mt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Editable value={title} onChange={onChange} label="Section title">
            <h2 className="text-[19px] font-bold text-ig-text">{title}</h2>
          </Editable>
          {info && <InfoIcon />}
        </div>
        {right}
      </div>
      {subtitle !== undefined && onSubtitle && (
        <Editable value={subtitle} onChange={onSubtitle} label="Subtitle">
          <p className="mt-1 text-[14px] text-ig-dim">{subtitle}</p>
        </Editable>
      )}
    </div>
  );
}

export function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] shrink-0 text-ig-dim"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 10.8v6M12 7.6v.6" strokeLinecap="round" />
    </svg>
  );
}
