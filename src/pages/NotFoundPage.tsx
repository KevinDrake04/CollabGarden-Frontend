import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="-mx-12 -mt-12 flex-1 bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-mt-8">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
        <div className="max-w-2xl">
          <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">Page not found</h1>
          <p className="mt-3 text-base">
            This address does not match a page on CollabGarden.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--cg-primary)] px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-[var(--cg-primary-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-primary-dark)]"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
