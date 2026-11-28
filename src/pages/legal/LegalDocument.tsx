import { type ReactNode } from "react";

const contactEmail = "collabgardennj@gmail.com";

export type LegalSection = {
  heading: string;
  body: string;
};

function sectionBody(body: string) {
  if (!body.includes(contactEmail)) return body;

  const parts = body.split(contactEmail);
  const nodes: ReactNode[] = [];
  parts.forEach((part, index) => {
    if (index > 0) {
      nodes.push(
        <a
          key={contactEmail}
          href={`mailto:${contactEmail}`}
          className="cg-focus font-semibold text-[var(--cg-primary-dark)] underline"
        >
          {contactEmail}
        </a>,
      );
    }
    if (part) nodes.push(part);
  });
  return nodes;
}

export function LegalDocument({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--cg-primary-dark)] md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm font-medium text-[var(--cg-muted)]">Effective as of 11/23/2026</p>
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.heading} className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--cg-text)]">{section.heading}</h2>
            <p className="mt-2 text-base leading-7 break-words text-[var(--cg-text)]">
              {sectionBody(section.body)}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
