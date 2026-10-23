import { Link, NavLink } from "react-router";
import { type LucideIcon, Sprout } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon?: LucideIcon;
}

const linkClass =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm no-underline";
const currentClass = "bg-[var(--cg-background)] text-[var(--cg-primary-dark)]";
const idleClass = "text-[var(--cg-muted)] hover:bg-[var(--cg-background)]";

interface PublicNavbarProps {
  links: NavItem[];
  action?: { label: string; to: string };
}

export function PublicNavbar({ links, action }: PublicNavbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--cg-border)] bg-white p-4">
      <Link
        to="/"
        className="inline-flex items-center gap-2 font-semibold text-[var(--cg-primary-dark)] no-underline"
      >
        <Sprout size={22} aria-hidden="true" />
        CollabGarden
      </Link>

      <div className="flex flex-wrap items-center gap-1">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${linkClass} ${isActive ? currentClass : idleClass}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {action && (
        <Link
          to={action.to}
          className="rounded-lg bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

interface DashboardSidebarProps {
  links: NavItem[];
  title?: string;
}

export function DashboardSidebar({
  links,
  title = "Workspace",
}: DashboardSidebarProps) {
  return (
    <div className="flex max-w-60 flex-col gap-1 rounded-xl border border-[var(--cg-border)] bg-white p-3">
      <strong className="px-3 py-2 text-sm">{title}</strong>
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${linkClass} ${isActive ? currentClass : idleClass}`
            }
          >
            {Icon && <Icon size={17} aria-hidden="true" />}
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}

export function MobileBottomNav({ links }: { links: NavItem[] }) {
  return (
    <div
      role="navigation"
      aria-label="Mobile navigation preview"
      className="flex justify-around gap-1 rounded-xl border border-[var(--cg-border)] bg-white p-2"
    >
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-xs no-underline ${
                isActive ? currentClass : idleClass
              }`
            }
          >
            {Icon && <Icon size={20} aria-hidden="true" />}
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
