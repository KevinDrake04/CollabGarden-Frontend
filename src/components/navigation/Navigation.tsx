import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Menu, X, type LucideIcon } from "lucide-react";
import { CountiesMenu } from "./CountiesMenu";

export interface NavItem {
  label: string;
  to: string;
  icon?: LucideIcon;
  end?: boolean;
  isCurrent?: (location: { pathname: string; search: string }) => boolean;
}

const linkClass =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm no-underline";
const focusClass = "cg-focus";
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
  identity?: string;
  action?: PublicAction;
  navLabel?: string;
}

function accountClass(isActive: boolean) {
  return `${focusClass} rounded-lg text-sm font-medium no-underline ${
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
        className={`${className} ${focusClass} cursor-pointer`}
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
    <Link to={action.to} onClick={onSelect} className={`${className} ${focusClass}`}>
      {action.label}
    </Link>
  );
}

function itemClass(active: boolean) {
  return `${linkClass} ${focusClass} ${active ? currentClass : idleClass}`;
}

function NavItemLink({ item, onSelect }: { item: NavItem; onSelect?: () => void }) {
  const location = useLocation();
  if (item.isCurrent) {
    const active = item.isCurrent({ pathname: location.pathname, search: location.search });
    return (
      <Link
        to={item.to}
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className={itemClass(active)}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end ?? true}
      onClick={onSelect}
      className={({ isActive }) => itemClass(isActive)}
    >
      {item.label}
    </NavLink>
  );
}

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
        <NavItemLink key={item.label} item={item} onSelect={onSelect} />
      ))}
    </>
  );
}

export function PublicNavbar({
  links,
  account,
  identity,
  action,
  navLabel = "Public",
}: PublicNavbarProps) {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const mobileNavId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname, search]);

  return (
    <div className="flex max-h-dvh w-full flex-col border-b border-[var(--cg-border)] bg-white lg:block lg:max-h-none">
      <div className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-4 py-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-4">
        <Link
          to="/"
          className={`inline-flex shrink-0 items-center gap-2 justify-self-start rounded-lg text-base font-semibold text-[var(--cg-primary-dark)] no-underline ${focusClass}`}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--cg-background)]">
            <img src="/favicon.svg" alt="" width={28} height={28} className="h-7 w-7" />
          </span>
          CollabGarden
        </Link>

        <nav
          className="hidden items-center justify-center gap-1 lg:flex lg:flex-wrap"
          aria-label={navLabel}
        >
          <PublicLinks links={links} />
          <CountiesMenu />
        </nav>

        <div className="hidden items-center justify-self-end gap-4 lg:flex">
          {identity && (
            <span className="hidden max-w-48 truncate text-sm text-[var(--cg-muted)] xl:inline" title={identity}>
              {identity}
            </span>
          )}
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
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cg-border)] bg-white text-[var(--cg-primary-dark)] lg:hidden ${focusClass}`}
          aria-expanded={open}
          aria-controls={open ? mobileNavId : undefined}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          id={mobileNavId}
          className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain border-t border-[var(--cg-border)] px-3 py-3 lg:hidden"
          aria-label={navLabel}
        >
          <PublicLinks links={links} onSelect={() => setOpen(false)} />
          <CountiesMenu variant="inline" onNavigate={() => setOpen(false)} />
          {identity && (
            <p className="break-all px-3 py-2 text-sm text-[var(--cg-muted)]">{identity}</p>
          )}
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
  const titleId = useId();
  return (
    <nav
      aria-labelledby={titleId}
      className={`flex flex-col gap-1 rounded-xl border border-[var(--cg-border)] bg-white p-3 ${
        expand ? "w-full" : "max-w-60"
      }`}
    >
      <strong id={titleId} className="px-3 py-2 text-sm">{title}</strong>
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `${linkClass} rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)] ${isActive ? currentClass : idleClass}`
            }
          >
            {Icon && <Icon size={17} aria-hidden="true" />}
            {item.label}
          </NavLink>
        );
      })}
    </nav>
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
