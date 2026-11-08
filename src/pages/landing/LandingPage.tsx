import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MapPin, Search, Users } from "lucide-react";
import { AppAvatar } from "../../components";
import {
  isFresh,
  loadDirectory,
  profilePath,
  readDirectory,
  type DirectoryEntry,
} from "../../api/directory";

const sectionClass = "mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-16";
const headingClass = "text-2xl font-bold text-[var(--cg-primary-dark)] md:text-3xl";
const actionClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold no-underline sm:w-auto";

const steps = [
  {
    icon: Search,
    title: "Find creators",
    body: "Search the directory for content creators in New Jersey.",
  },
  {
    icon: MapPin,
    title: "Choose a county",
    body: "Narrow the list to the counties you want to work in.",
    link: { label: "Explore all 21 NJ counties", to: "/discover" },
  },
  {
    icon: Users,
    title: "Collaborate",
    body: "Open a profile to see a creator who works nearby.",
  },
];

const footerGroups = [
  {
    title: "Explore",
    links: [
      { label: "Discover", to: "/discover" },
      { label: "Creators", to: "/discover?type=creator" },
    ],
  },
  {
    title: "Counties",
    links: [
      { label: "Essex", to: "/discover?type=creator&county=Essex" },
      { label: "Hudson", to: "/discover?type=creator&county=Hudson" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", to: "/login" },
      { label: "Sign up", to: "/signup" },
    ],
  },
];

function ActionLink({
  to,
  variant = "primary",
  children,
}: {
  to: string;
  variant?: "primary" | "secondary";
  children: string;
}) {
  const className =
    variant === "primary"
      ? `${actionClass} bg-[var(--cg-primary)] text-white hover:bg-[var(--cg-primary-dark)]`
      : `${actionClass} border border-[var(--cg-primary)] bg-white text-[var(--cg-primary-dark)] hover:bg-[var(--cg-background)]`;

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

function CreatorPreview({ entry }: { entry: DirectoryEntry }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--cg-border)] bg-white shadow-sm">
      {entry.imageUrl && (
        <img
          src={entry.imageUrl}
          alt=""
          className="h-36 w-full object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <AppAvatar name={entry.name} size="sm" />
          <strong className="min-w-0 break-words text-[var(--cg-text)]">
            {entry.name}
          </strong>
        </div>
        <p className="text-sm text-[var(--cg-muted)]">{entry.category}</p>
        <p className="flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
          <MapPin size={14} aria-hidden="true" />
          {entry.county ? `${entry.county} County, NJ` : "New Jersey"}
        </p>
        <Link
          to={profilePath(entry)}
          className="mt-auto inline-flex self-end rounded-lg bg-[var(--cg-primary)] px-3 py-2 text-sm font-semibold text-white no-underline"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}

function featuredCreators(entries: DirectoryEntry[]) {
  return entries.filter((entry) => entry.name.trim()).slice(0, 4);
}

export default function LandingPage() {
  const savedCreators = readDirectory("creator", [], "");
  const [creators, setCreators] = useState<DirectoryEntry[]>(() =>
    savedCreators ? featuredCreators(savedCreators.entries) : [],
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    savedCreators ? "ready" : "loading",
  );
  const [refreshNote, setRefreshNote] = useState("");

  useEffect(() => {
    const saved = readDirectory("creator", [], "");
    if (saved && isFresh(saved.savedAt)) return;

    let active = true;
    loadDirectory("creator", [])
      .then((entries) => {
        if (!active) return;
        setCreators(featuredCreators(entries));
        setStatus("ready");
        setRefreshNote("");
      })
      .catch((error: Error) => {
        if (!active || error.name === "AbortError") return;
        if (readDirectory("creator", [], "")) {
          setStatus("ready");
          setRefreshNote("Couldn't refresh featured creators.");
        } else {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="text-[var(--cg-text)]">
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:gap-12 md:px-8 md:py-16">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--cg-primary)] uppercase">
            New Jersey
          </p>
          <h1 className="mt-3 text-4xl leading-[1.1] font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-5xl">
            Grow Local.
            <br />
            Collaborate Local.
          </h1>
          <p className="mt-4 max-w-md text-base text-[var(--cg-muted)]">
            CollabGarden connects local New Jersey businesses with content creators.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ActionLink to="/discover?type=creator">Find Creators</ActionLink>
            <ActionLink to="/signup?role=creator" variant="secondary">
              Join as Creator
            </ActionLink>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl">
          <img
            src="/images/cafe-collab.jpg"
            alt="People meeting over coffee and a laptop in a cafe"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 hidden rounded-xl bg-white/95 px-4 py-3 shadow-sm md:block">
            <p className="text-sm font-semibold text-[var(--cg-primary-dark)]">
              Local businesses and creators
            </p>
            <p className="text-xs text-[var(--cg-muted)]">Find someone nearby to work with.</p>
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="creators-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="creators-heading" className={headingClass}>
              Featured Creators
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--cg-muted)]">
              Creators currently listed in the directory.
            </p>
          </div>
          <Link
            to="/discover?type=creator"
            className="inline-flex rounded-xl border border-[var(--cg-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
          >
            View all
          </Link>
        </div>

        {refreshNote && status === "ready" && (
          <div className="mt-4 text-sm text-[var(--cg-error)]" role="status">
            {refreshNote}
          </div>
        )}
        {status === "loading" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading creators">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : status === "error" ? (
          <p className="mt-6 text-sm text-[var(--cg-muted)]">
            Creators are unavailable right now.{" "}
            <Link to="/discover?type=creator" className="font-semibold text-[var(--cg-primary-dark)]">
              Browse the directory
            </Link>
          </p>
        ) : creators.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--cg-muted)]">
            No creators to show yet.{" "}
            <Link to="/discover?type=creator" className="font-semibold text-[var(--cg-primary-dark)]">
              Browse the directory
            </Link>
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {creators.map((entry) => (
              <CreatorPreview key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-white" aria-labelledby="how-heading">
        <div className={sectionClass}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h2 id="how-heading" className={headingClass}>
              How It Works
            </h2>
            <p className="max-w-sm text-sm text-[var(--cg-muted)] md:text-right">
              Search, pick a county, then open a profile.
            </p>
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title}>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--cg-background)] text-[var(--cg-primary)]">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-[var(--cg-primary-dark)]">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--cg-muted)]">{step.body}</p>
                  {"link" in step && step.link && (
                    <Link
                      to={step.link.to}
                      className="mt-2 inline-block text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
                    >
                      {step.link.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[var(--cg-background)]" aria-labelledby="invite-heading">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8 md:py-16">
          <div>
            <h2 id="invite-heading" className={headingClass}>
              Join the community.
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--cg-muted)]">
              Businesses and creators in New Jersey can join CollabGarden.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ActionLink to="/discover?type=creator">Find Creators</ActionLink>
            <ActionLink to="/signup?role=creator" variant="secondary">
              Join as Creator
            </ActionLink>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
          <div>
            <p className="font-semibold text-[var(--cg-primary-dark)]">CollabGarden</p>
            <p className="mt-2 max-w-xs text-sm text-[var(--cg-muted)]">
              A directory for local New Jersey businesses and content creators.
            </p>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-[var(--cg-text)]">{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.links.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-[var(--cg-muted)] no-underline hover:text-[var(--cg-primary-dark)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-[var(--cg-border)] px-4 py-4 md:px-8">
          <p className="text-xs text-[var(--cg-muted)]">© 2026 CollabGarden</p>
          <div className="flex gap-4">
            <Link to="/" className="text-xs text-[var(--cg-muted)] no-underline">
              Home
            </Link>
            <Link to="/discover" className="text-xs text-[var(--cg-muted)] no-underline">
              Discover
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
