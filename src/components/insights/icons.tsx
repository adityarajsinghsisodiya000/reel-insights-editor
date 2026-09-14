type IconProps = {
  className?: string;
};

export function LikeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className ?? "h-6 w-6"}>
      <path d="M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 8.2a4.4 4.4 0 0 1 7.5 2.7c0 5-7.5 9.6-7.5 9.6Z" strokeLinejoin="round" />
    </svg>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className ?? "h-6 w-6"}>
      <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" strokeLinejoin="round" />
    </svg>
  );
}

export function RepostIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className ?? "h-6 w-6"}>
      <path d="M4 9V7.5A3.5 3.5 0 0 1 7.5 4H16" strokeLinecap="round" />
      <path d="m13.5 1.8 2.8 2.2-2.8 2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 15v1.5a3.5 3.5 0 0 1-3.5 3.5H8" strokeLinecap="round" />
      <path d="m10.5 22.2-2.8-2.2 2.8-2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-6 w-6"}>
      <path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" />
      <line x1="7.488" y1="12.208" x2="15.515" y2="7.641" />
    </svg>
  );
}

export function SaveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className ?? "h-6 w-6"}>
      <path d="M6 3.5h12v17l-6-4.6-6 4.6v-17Z" strokeLinejoin="round" />
    </svg>
  );
}

export const HeartIcon = LikeIcon;
export const BookmarkIcon = SaveIcon;
