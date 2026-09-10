type IconName = "arrow" | "check" | "chevron" | "close" | "code" | "download" | "pause" | "play" | "redo" | "reset" | "shuffle" | "undo" | "upload" | "lock" | "unlock";

const paths: Record<IconName, string> = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  chevron: "m8 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20",
  download: "M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5",
  pause: "M8 5v14M16 5v14",
  play: "m8 4 12 8-12 8Z",
  redo: "M20 4v6h-6m6 0a8 8 0 1 0-2 8",
  reset: "M4 4v6h6m-6 0a8 8 0 1 1 2 8",
  shuffle: "M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4",
  undo: "M4 4v6h6m-6 0a8 8 0 1 1 2 8",
  upload: "M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5",
  lock: "M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4",
  unlock: "M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0",
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
