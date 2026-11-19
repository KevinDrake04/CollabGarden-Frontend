import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { verifiedBusinessIds } from "../../api/auth";
import { PublicNavbar, type NavItem } from "../../components";
import {
  readRememberedBusiness,
  resolvedBusinessId,
  businessSearch,
} from "../dashboard/selectedBusiness";
import { refreshSession, useLiveSession, type Session } from "./session";
import { RoleSelectModal } from "./RoleSelectModal";

const signedOutLinks: NavItem[] = [
  { label: "Home", to: "/", end: true },
  { label: "Discover", to: "/discover", end: true },
  { label: "Campaigns", to: "/campaigns", end: true },
];

function businessQuery(session: Session, search: string) {
  const ids = verifiedBusinessIds(session);
  const remembered = readRememberedBusiness(session.userId, ids);
  const selected = resolvedBusinessId(new URLSearchParams(search).get("business"), ids, [
    remembered,
    session.businessId,
  ]);
  return businessSearch(selected);
}

function workspaceLinks(session: Session, search: string): NavItem[] {
  if (session.role === "business") {
    const query = businessQuery(session, search);
    return [
      { label: "Overview", to: `/dashboard/business${query}`, end: true },
      {
        label: "My Campaigns",
        to: `/dashboard/business/campaigns${query}`,
        isCurrent: (location) =>
          location.pathname === "/dashboard/business/campaigns"
          || location.pathname === "/campaigns/new"
          || /^\/campaigns\/\d+\/edit$/.test(location.pathname),
      },
      {
        label: "Discover Creators",
        to: "/discover?type=creator",
        isCurrent: (location) =>
          location.pathname.startsWith("/creators/")
          || (location.pathname === "/discover" && new URLSearchParams(location.search).get("type") === "creator"),
      },
      { label: "Collaborations", to: `/dashboard/business/review${query}`, end: true },
      { label: "Account", to: `/dashboard/business/account${query}`, end: true },
    ];
  }

  if (session.role === "creator") {
    return [
      { label: "Overview", to: "/dashboard/creator", end: true },
      { label: "Opportunities", to: "/dashboard/creator/opportunities", end: true },
      {
        label: "Discover Businesses",
        to: "/discover",
        isCurrent: (location) =>
          location.pathname.startsWith("/businesses/")
          || (location.pathname === "/discover" && new URLSearchParams(location.search).get("type") !== "creator"),
      },
      { label: "My Deliverables", to: "/dashboard/creator/deliverables", end: true },
      { label: "Account", to: "/dashboard/creator/account", end: true },
    ];
  }

  return [
    { label: "Overview", to: "/dashboard/admin", end: true },
    { label: "Approvals", to: "/dashboard/admin/approvals", end: true },
    { label: "Accounts", to: "/dashboard/admin/accounts", end: true },
    { label: "Founding Members", to: "/dashboard/admin/founding-members", end: true },
    { label: "Campaigns", to: "/dashboard/admin/campaigns", end: true },
  ];
}

export function SiteHeader() {
  const session = useLiveSession();
  const { search } = useLocation();
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    refreshSession(controller.signal).catch(() => {
      // A 401 clears the stored session and marks it expired. Other failures leave it in place.
    });
    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="site-header">
        <PublicNavbar
          links={session ? workspaceLinks(session, search) : signedOutLinks}
          navLabel={session ? "Workspace" : "Public"}
          identity={session?.email}
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
