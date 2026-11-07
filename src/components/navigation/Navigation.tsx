import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, Sprout, X, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon?: LucideIcon;
  end?: boolean;
}

const linkClass =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm no-underline";
const currentClass = "bg-[var(--cg-background)] text-[var(--cg-primary-dark)]";
const idleClass = "text-[var(--cg-muted)] hover:bg-[var(--cg-background)]";

interface PublicAction {
  label: string;
  to: string;
  onPress?: () => void;
  expanded?: boolean;
}

interface PublicNavbarProps {
  links: NavItem[];
  account?: { label: string; to: string };
  action?: PublicAction;
}

function accountClass(isActive: boolean) {
  return `text-sm font-medium no-underline ${
    isActive
      ? "text-[var(--cg-primary-dark)]"
      : "text-[var(--cg-text)] hover:text-[var(--cg-primary-dark)]"
  }`;
}

function PublicActionControl({
  action,
  className,
  onSelect,
}: {
  action: PublicAction;
  className: string;
  onSelect?: () => void;
}) {
  if (action.onPress) {
    return (
      <button
        type="button"
        className={`${className} cursor-pointer`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(action.expanded)}
        onClick={() => {
          onSelect?.();
          action.onPress?.();
        }}
      >
        {action.label}
      </button>
    );
  }

  return (
    <Link to={action.to} onClick={onSelect} className={className}>
      {action.label}
    </Link>
  );
}

// Same links in the desktop bar and the mobile menu.
function PublicLinks({
  links,
  onSelect,
}: {
  links: NavItem[];
  onSelect?: () => void;
}) {
  return (
    <>
      {links.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          onClick={onSelect}
          className={({ isActive }) =>
            `${linkClass} ${isActive ? currentClass : idleClass}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function PublicNavbar({ links, account, action }: PublicNavbarProps) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="w-full border-b border-[var(--cg-border)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:px-8 md:py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 justify-self-start text-base font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cg-background)] text-[var(--cg-primary)]">
            <Sprout size={18} aria-hidden="true" />
          </span>
          CollabGarden
        </Link>

        <nav
          className="hidden items-center justify-self-center gap-1 md:flex"
          aria-label="Public"
        >
          <PublicLinks links={links} />
        </nav>

        <div className="hidden items-center justify-self-end gap-4 md:flex">
          {account && (
            <NavLink
              to={account.to}
              className={({ isActive }) => accountClass(isActive)}
            >
              {account.label}
            </NavLink>
          )}
          {action && (
            <PublicActionControl
              action={action}
              className="shrink-0 rounded-xl bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline"
            />
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cg-border)] bg-white text-[var(--cg-primary-dark)] md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          className="flex flex-col gap-1 border-t border-[var(--cg-border)] px-3 py-3 md:hidden"
          aria-label="Public"
        >
          <PublicLinks links={links} onSelect={() => setOpen(false)} />
          {account && (
            <NavLink
              to={account.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `px-3 py-2 ${accountClass(isActive)}`}
            >
              {account.label}
            </NavLink>
          )}
          {action && (
            <PublicActionControl
              action={action}
              onSelect={() => setOpen(false)}
              className="mt-1 rounded-xl bg-[var(--cg-primary)] px-4 py-3 text-center text-sm font-semibold text-white no-underline"
            />
          )}
        </nav>
      )}
    </div>
  );
}

interface DashboardSidebarProps {
  links: NavItem[];
  title?: string;
  expand?: boolean;
}

export function DashboardSidebar({
  links,
  title = "Workspace",
  expand = false,
}: DashboardSidebarProps) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border border-[var(--cg-border)] bg-white p-3 ${
        expand ? "w-full" : "max-w-60"
      }`}
    >
      <strong className="px-3 py-2 text-sm">{title}</strong>
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
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
            end={item.end}
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
