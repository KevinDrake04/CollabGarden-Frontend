import { AppButton, AppInput, AppTextarea } from "../../../components";
import { creatorProfileLimits } from "../../../api/creatorProfile";

export type SamplePostDraft = {
  key: string;
  url: string;
  caption: string;
};

export function SamplePostsField({
  posts,
  errors,
  disabled,
  onChange,
  onRemove,
  onAdd,
}: {
  posts: SamplePostDraft[];
  errors: Record<string, { url?: string; caption?: string; row?: string }>;
  disabled: boolean;
  onChange: (key: string, patch: Partial<Pick<SamplePostDraft, "url" | "caption">>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const atLimit = posts.length >= creatorProfileLimits.samplePosts;

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-medium text-[var(--cg-text)]">Sample posts</legend>
      <p className="text-xs text-[var(--cg-muted)]">
        Add a link, a caption, or both. You can keep up to {creatorProfileLimits.samplePosts} posts.
      </p>
      {posts.length === 0 && (
        <p className="text-sm text-[var(--cg-muted)]">No sample posts yet.</p>
      )}
      {posts.map((post, index) => {
        const rowError = errors[post.key];
        const position = index + 1;
        return (
          <div key={post.key} className="rounded-xl border border-[var(--cg-border)] bg-[var(--cg-background)] p-3">
            <div className="grid gap-3">
              <AppInput
                label={`Post ${position} link`}
                name={`sample-post-url-${post.key}`}
                type="url"
                value={post.url}
                onChange={(url) => onChange(post.key, { url })}
                placeholder="https://instagram.com/p/example"
                error={rowError?.url}
                disabled={disabled}
              />
              <AppTextarea
                label={`Post ${position} caption`}
                name={`sample-post-caption-${post.key}`}
                value={post.caption}
                onChange={(caption) => onChange(post.key, { caption })}
                placeholder="What this post shows"
                rows={3}
                error={rowError?.caption || rowError?.row}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              className="cg-focus mt-2 cursor-pointer rounded-lg text-sm font-semibold text-[var(--cg-error)] disabled:cursor-not-allowed disabled:text-[var(--cg-muted)]"
              onClick={() => onRemove(post.key)}
              disabled={disabled}
            >
              Remove post {position}
            </button>
          </div>
        );
      })}
      <AppButton
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        isDisabled={disabled || atLimit}
        onPress={onAdd}
      >
        Add sample post
      </AppButton>
    </fieldset>
  );
}
