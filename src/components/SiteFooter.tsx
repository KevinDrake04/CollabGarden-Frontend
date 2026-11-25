import { NavLink } from "react-router";

const linkClass =
  "cg-focus inline-flex min-h-11 items-center rounded-lg text-sm text-[var(--cg-muted)] no-underline hover:text-[var(--cg-primary-dark)]";

function footerLinkClass(isActive: boolean) {
  return `${linkClass} ${isActive ? "font-semibold text-[var(--cg-primary-dark)]" : ""}`;
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--cg-border)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p className="text-sm text-[var(--cg-muted)]">© 2026 CollabGarden</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <li>
              <NavLink to="/terms" className={({ isActive }) => footerLinkClass(isActive)}>
                Terms of Use
              </NavLink>
            </li>
            <li>
              <NavLink to="/privacy" className={({ isActive }) => footerLinkClass(isActive)}>
                Privacy Policy
              </NavLink>
            </li>
            <li>
              <a
                href="https://www.instagram.com/collabgardennj"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
