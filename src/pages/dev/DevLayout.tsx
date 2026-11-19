import { NavLink, Outlet } from "react-router";

const devSections = [
  {
    title: "Website",
    links: [
      ["Public website", "/"],
      ["Campaigns", "/campaigns"],
      ["New campaign", "/campaigns/new"],
    ],
  },
  {
    title: "Development",
    links: [
      ["Home", "/dev"],
      ["Components", "/dev/components"],
      ["Messages", "/dev/app/messages"],
      ["Payments", "/dev/app/payments"],
      ["Profile", "/dev/app/profile"],
    ],
  },
] as const;

export function DevLayout() {
  return (
    <>
      <header>
        <strong>CollabGarden</strong>
        <span>Development</span>
      </header>

      <div className="shell">
        <nav aria-label="Development">
          {devSections.map((section) => (
            <div key={section.title}>
              <h2>{section.title}</h2>

              {section.links.map(([label, url]) => (
                <NavLink
                  key={url}
                  end
                  to={url}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}

export function PlaceholderPage({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <p className="eyebrow">Temporary page</p>
      <h1>{title}</h1>
      <p>{note ?? "Page layout and functionality will be added later."}</p>
    </>
  );
}
