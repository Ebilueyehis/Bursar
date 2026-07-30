import type { SVGProps } from "react";

/**
 * Small inline icon set. Kept in-repo (rather than an icon dependency) so the
 * app installs and loads lean on low-end phones and slow connections.
 * Stroke-based, currentColor, 24px grid.
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const DashboardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const DebtorsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6h18" />
    <path d="M3 12h18" />
    <path d="M3 18h12" />
    <circle cx="19" cy="18" r="2.5" />
  </svg>
);

export const StudentsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.25" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const MoneyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9v6M18 9v6" />
  </svg>
);

export const ReportIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13l2 2 4-4" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15V3" />
    <path d="M7 8l5-5 5 5" />
    <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  </svg>
);

export const PhoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5c0-1 .8-2 2-2h1.5a1 1 0 0 1 1 .75l.8 3a1 1 0 0 1-.3 1L8 9c1 2 2.5 3.5 4.5 4.5l1.3-1a1 1 0 0 1 1-.3l3 .8a1 1 0 0 1 .7 1V16c0 1.2-1 2-2 2A14 14 0 0 1 4 5Z" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l9 16H3l9-16Z" />
    <path d="M12 10v4M12 17.5h.01" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12l16-8-6 16-3-6-7-2Z" />
  </svg>
);

export const LedgerIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3V3Z" />
    <path d="M5 18a3 3 0 0 1 3-3h11" />
    <path d="M9 7h6M9 11h6" />
  </svg>
);

export const ExpenseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M17 9l3-3M20 6h-2.5M20 6v2.5" />
  </svg>
);

export const StaffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5M18 20a6 6 0 0 0-3-5.2" />
  </svg>
);
