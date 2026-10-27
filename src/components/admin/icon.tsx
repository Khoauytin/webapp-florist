const PATHS = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  cal: <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 10h18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  flower: <><circle cx="12" cy="12" r="2.6" /><path d="M12 9.4C10.2 7 10.6 3.8 12 3c1.4.8 1.8 4 0 6.4zM14.6 12c2.4-1.8 5.6-1.4 6.4 0-.8 1.4-4 1.8-6.4 0zM12 14.6c1.8 2.4 1.4 5.6 0 6.4-1.4-.8-1.8-4 0-6.4zM9.4 12C7 13.8 3.8 13.4 3 12c.8-1.4 4-1.8 6.4 0z" /></>,
  users: <><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></>,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>,
  next: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  more: <><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13 7l4 4" /></>,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5L20 7" />,
  circle: <circle cx="12" cy="12" r="8.5" />,
  truck: <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  done: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  ban: <><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></>,
  tag: <><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z" /><circle cx="8" cy="8" r="1.5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  out: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M16 13h2M3 10h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  download: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5M9 18h6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} viewBox="0 0 24 24" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      {PATHS[name]}
    </svg>
  );
}

export const STATUS_ICON = { NEW: "circle", DELIVERING: "truck", COMPLETED: "done", CANCELLED: "ban" } as const;
