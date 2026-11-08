import { useEffect, useState } from "react";
import { PublicNavbar, type NavItem } from "../../components";
import { dashboardPath, refreshSession, useLiveSession, type Session } from "./session";
import { RoleSelectModal } from "./RoleSelectModal";

function publicLinks(session: Session | null): NavItem[] {
  const links: NavItem[] = [
    { label: "Home", to: "/" },
    { label: "Discover", to: "/discover" },
    { label: "Campaigns", to: "/campaigns" },
  ];
  if (session) links.push({ label: "Dashboard", to: dashboardPath(session.role) });
  return links;
}

export function SiteHeader() {
  const session = useLiveSession();
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    refreshSession(controller.signal).catch(() => {
      // A 401 clears the stored session. Other failures leave it in place.
    });
    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="site-header">
        <PublicNavbar
          links={publicLinks(session)}
          account={session ? { label: "Log out", to: "/logout" } : { label: "Log in", to: "/login" }}
          action={
            session
              ? undefined
              : {
                  label: "Sign up",
                  to: "/signup",
                  expanded: roleModalOpen,
                  onPress: () => setRoleModalOpen(true),
                }
          }
        />
      </header>
      <RoleSelectModal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} />
    </>
  );
}
