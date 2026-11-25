import { Globe } from "lucide-react";
import { visibleCreatorLinks, type CreatorLinkInput } from "./creatorLinkList";

export function CreatorProfileLinks({
  links,
}: {
  links?: CreatorLinkInput[] | null;
}) {
  const visible = visibleCreatorLinks(links);
  if (visible.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-[var(--cg-muted)]">Social</div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {visible.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label}, opens in a new tab`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cg-border)] bg-[var(--cg-background)] px-3 py-1 text-sm font-medium text-[var(--cg-primary-dark)] no-underline"
            >
              {link.icon ? (
                <img src={link.icon} alt="" width={14} height={14} className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Globe size={14} className="shrink-0 text-[var(--cg-primary)]" aria-hidden="true" />
              )}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
