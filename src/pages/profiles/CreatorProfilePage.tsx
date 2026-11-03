import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { ArrowUpRight, Users } from "lucide-react";
import {
  ApiError,
  countyNameForId,
  isFresh,
  loadCreator,
  readCreator,
  type County,
  type Creator,
} from "../directory/api";
import {
  AppNotice,
  CountyList,
  ProfileActions,
  ProfileDetails,
  ProfileHeader,
} from "../../components";
import {
  BackToDiscover,
  ProfilePage,
  ProfileStatus,
  isAbortError,
  parseProfileId,
  type ProfileLoadStatus,
} from "./ProfileChrome";

function safeHttpUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function CreatorProfile({
  creator,
  counties,
}: {
  creator: Creator;
  counties: County[];
}) {
  const name = creator.display_name.trim() || "Unnamed creator";
  const niche = creator.niche?.trim() || "";
  const bio = creator.bio?.trim() || "";
  const followerRange = creator.follower_range?.trim() || "";
  const countyName = countyNameForId(creator.county_id, counties);
  const countyMissing = creator.county_id == null
    ? "No county listed."
    : "County name is unavailable.";
  const posts = (creator.sample_posts ?? []).flatMap((post, index) => {
    if (!post) return [];
    const caption = post.caption?.trim() || "";
    const href = safeHttpUrl(post.url);
    if (!caption && !href) return [];
    return [{ caption, href, index }];
  });

  return (
    <>
      <ProfileHeader
        eyebrow="Creator"
        name={name}
        imageUrl={creator.photo_url || undefined}
        summary={niche}
        emptySummary="No niche listed."
        action={
          <ProfileActions
            actions={[{ label: "Collaborate", disabled: true, badge: "Coming soon" }]}
          />
        }
      >
        <div className="mt-4">
          <div className="mb-2 text-sm text-[var(--cg-muted)]">County</div>
          <CountyList
            names={countyName ? [countyName] : []}
            missingLabel={countyMissing}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--cg-muted)]">
          <Users size={15} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
          <span>Followers</span>
          <span className="font-medium text-[var(--cg-text)]">
            {followerRange || "Not listed"}
          </span>
        </div>
      </ProfileHeader>

      <ProfileDetails title="About" text={bio} emptyLabel="No bio yet." />

      <ProfileDetails
        title="Sample posts"
        emptyLabel={posts.length === 0 ? "No sample posts yet." : undefined}
      >
        {posts.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {posts.map((post) => (
              <li
                key={post.index}
                className="rounded-xl bg-[var(--cg-background)] p-4"
              >
                {post.caption && (
                  <div className="text-sm leading-relaxed break-words text-[var(--cg-text)]">
                    {post.caption}
                  </div>
                )}
                {post.href && (
                  <a
                    href={post.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${post.caption ? "mt-2" : ""} inline-flex items-center gap-1 text-sm font-semibold text-[var(--cg-primary-dark)] no-underline`}
                  >
                    View post
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </ProfileDetails>
    </>
  );
}

export default function CreatorProfilePage() {
  const { id: idParam } = useParams();
  const routeId = parseProfileId(idParam);
  const initial = routeId ? readCreator(routeId) : null;
  const [trackedId, setTrackedId] = useState(routeId);
  const [status, setStatus] = useState<ProfileLoadStatus>(
    routeId ? (initial ? "ready" : "loading") : "missing",
  );
  const [creator, setCreator] = useState<Creator | null>(initial?.creator ?? null);
  const [counties, setCounties] = useState<County[]>(initial?.counties ?? []);
  const [refreshNote, setRefreshNote] = useState("");
  const [retry, setRetry] = useState(0);
  const handledRetry = useRef(retry);
  const idRef = useRef(routeId);
  idRef.current = routeId;

  if (trackedId !== routeId) {
    const saved = routeId ? readCreator(routeId) : null;
    setTrackedId(routeId);
    setRefreshNote("");
    if (!routeId) {
      setCreator(null);
      setStatus("missing");
    } else if (saved) {
      setCreator(saved.creator);
      setCounties(saved.counties);
      setStatus("ready");
    } else {
      setCreator(null);
      setCounties([]);
      setStatus("loading");
    }
  }

  useEffect(() => {
    if (!routeId) return;
    const forceRefresh = handledRetry.current !== retry;
    handledRetry.current = retry;
    const saved = readCreator(routeId);
    if (saved && isFresh(saved.savedAt) && !forceRefresh) return;

    let active = true;
    const requestedId = routeId;
    loadCreator(requestedId)
      .then((next) => {
        if (!active || idRef.current !== requestedId) return;
        setCreator(next.creator);
        setCounties(next.counties);
        setStatus("ready");
        setRefreshNote("");
      })
      .catch((error: unknown) => {
        if (!active || idRef.current !== requestedId || isAbortError(error)) return;
        const latest = readCreator(requestedId);
        if (latest) {
          setCreator(latest.creator);
          setCounties(latest.counties);
          setStatus("ready");
          setRefreshNote("Couldn't refresh this profile. Showing the last results.");
          return;
        }
        setCreator(null);
        setStatus(error instanceof ApiError && error.status === 404 ? "missing" : "error");
      });

    return () => {
      active = false;
    };
  }, [routeId, retry]);

  const discoverTo = "/discover?type=creator";

  return (
    <ProfilePage>
      <BackToDiscover to={discoverTo} />
      {refreshNote && status === "ready" && (
        <AppNotice tone="error" message={refreshNote} onClose={() => setRefreshNote("")} />
      )}
      {status === "ready" && creator ? (
        <CreatorProfile creator={creator} counties={counties} />
      ) : (
        <ProfileStatus
          status={status === "ready" ? "missing" : status}
          loadingLabel="Loading creator profile"
          errorMessage="Couldn't load this creator. Please try again."
          missingTitle="Creator not found"
          missingDescription="This creator is not listed in the directory."
          discoverTo={discoverTo}
          onRetry={() => {
            setCreator(null);
            setStatus("loading");
            setRetry((value) => value + 1);
          }}
        />
      )}
    </ProfilePage>
  );
}
