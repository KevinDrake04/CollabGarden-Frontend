import { useState } from "react";
import { Link } from "react-router";
import {
  AdminCampaignRow,
  AdminEmptyState,
  AdminStatCard,
  AppButton,
  AppSelect,
  AppTextarea,
  ConfirmDialog,
  FoundingMemberCard,
  PendingAccountCard,
  adminStatusLabel,
} from "../../components";
import { messageFromApiBody } from "./api";

type Section = "overview" | "approvals" | "founding" | "campaigns" | "accounts";
type Role = "signed-out" | "business" | "creator" | "administrator";
type Outcome = "confirmed" | "permission" | "validation";
type AccountStatus = "pending" | "approved" | "suspended";
type WaitlistStatus = "waiting" | "invited" | "active" | "rejected";

type SampleAccount = {
  id: number;
  name: string;
  type: string;
  status: AccountStatus;
};

type SampleMember = {
  id: number;
  name: string;
  detail: string;
  status: WaitlistStatus;
  note: string;
};

type PendingChange =
  | { kind: "account"; id: number; name: string; status: AccountStatus }
  | { kind: "waitlist"; id: number; name: string; status: WaitlistStatus };

const sections: Array<[Section, string]> = [
  ["overview", "Overview"],
  ["approvals", "Pending approvals"],
  ["founding", "Founding members"],
  ["campaigns", "Campaigns"],
  ["accounts", "Accounts"],
];

const roles: Array<[Role, string]> = [
  ["signed-out", "Signed out"],
  ["business", "Business"],
  ["creator", "Creator"],
  ["administrator", "Administrator"],
];

const initialAccounts: SampleAccount[] = [
  { id: 9001, name: "Sample Cafe", type: "Business", status: "pending" },
  { id: 9002, name: "Sample Studio", type: "Creator", status: "pending" },
  { id: 9003, name: "Sample Market", type: "Business", status: "approved" },
  { id: 9004, name: "Sample Paused Creator", type: "Creator", status: "suspended" },
];

const initialMembers: SampleMember[] = [
  { id: 9101, name: "Sample Priya Shah", detail: "Creator · Essex · priya@example.com", status: "waiting", note: "" },
  { id: 9102, name: "Sample Bloom Bakery", detail: "Business · Hudson · bloom@example.com", status: "invited", note: "Sample note" },
];

const sampleCampaigns = [
  { id: 9201, name: "Sample Spring Tasting", detail: "Sample Cafe · Paid · May 1, 2026 - May 31, 2026 · Essex", status: "open" },
  { id: 9202, name: "Sample Draft Launch", detail: "Sample Market · Gifted · No dates · Hudson", status: "draft" },
  { id: 9203, name: "Sample Closed Winter", detail: "Sample Cafe · Dining · Jan 1, 2026 - Jan 31, 2026 · Bergen", status: "closed" },
];

function sampleResult(outcome: Outcome) {
  return new Promise<void>((resolve, reject) => {
    window.setTimeout(() => {
      if (outcome === "confirmed") {
        resolve();
        return;
      }
      if (outcome === "permission") {
        reject(new Error("Sample permission error: administrator access was denied."));
        return;
      }
      const formatted = messageFromApiBody(422, {
        detail: [
          {
            loc: ["body", "status"],
            msg: "Input should be 'pending', 'approved' or 'suspended'",
            type: "literal_error",
          },
        ],
      });
      reject(new Error(`Sample validation error: ${formatted}`));
    }, 400);
  });
}

export default function AdminPrototypePage() {
  const [section, setSection] = useState<Section>("overview");
  const [role, setRole] = useState<Role>("signed-out");
  const [outcome, setOutcome] = useState<Outcome>("confirmed");
  const [showEmpty, setShowEmpty] = useState(false);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [members, setMembers] = useState(initialMembers);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const enabled = role === "administrator";

  async function commit() {
    if (!pending || busy) return;
    if (!enabled) {
      setNoticeTone("error");
      setNotice("Administrator actions are disabled for this sample role.");
      setPending(null);
      return;
    }
    setBusy(true);
    const change = pending;
    const note = reviewNote.trim();
    try {
      await sampleResult(outcome);
      if (change.kind === "account") {
        setAccounts((current) =>
          current.map((account) => account.id === change.id ? { ...account, status: change.status } : account),
        );
      } else {
        setMembers((current) =>
          current.map((member) =>
            member.id === change.id ? { ...member, status: change.status, note: note || member.note } : member,
          ),
        );
      }
      setNoticeTone("success");
      setNotice(`Sample response confirmed ${change.name} is now ${adminStatusLabel(change.status).toLowerCase()}.`);
      setPending(null);
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Sample request failed.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function accountActions(account: SampleAccount) {
    return (
      <div className="flex flex-wrap gap-2">
        {account.status !== "approved" && (
          <AppButton
            isDisabled={!enabled || busy}
            aria-label={`${account.status === "pending" ? "Approve" : "Set approved"} ${account.name}`}
            onPress={() => {
              setReviewNote("");
              setPending({ kind: "account", id: account.id, name: account.name, status: "approved" });
            }}
          >
            {account.status === "pending" ? "Approve" : "Set approved"}
          </AppButton>
        )}
        {account.status !== "suspended" && (
          <AppButton
            variant="destructive"
            isDisabled={!enabled || busy}
            aria-label={`Suspend ${account.name}`}
            onPress={() => {
              setReviewNote("");
              setPending({ kind: "account", id: account.id, name: account.name, status: "suspended" });
            }}
          >
            Suspend
          </AppButton>
        )}
      </div>
    );
  }

  const pendingAccounts = accounts.filter((account) => account.status === "pending");
  const shownAccounts = section === "approvals" ? pendingAccounts : accounts;
  const destructive = pending?.status === "suspended" || pending?.status === "rejected";

  return (
    <div className="max-w-4xl text-[var(--cg-text)]">
      <p className="eyebrow">Sample data</p>
      <h1>Admin prototype</h1>
      <div className="mt-3 max-w-2xl text-sm">
        Sample records for layout checks. This page does not call the administrator API.
        The user-facing dashboard is at{" "}
        <Link to="/dashboard/admin" className="font-semibold text-[var(--cg-primary-dark)] no-underline">
          /dashboard/admin
        </Link>
        .
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Prototype sections">
        {sections.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={section === value}
            onClick={() => setSection(value)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              section === value
                ? "border-[var(--cg-primary)] bg-[var(--cg-background)] text-[var(--cg-primary-dark)]"
                : "border-[var(--cg-border)] bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div role="group" aria-label="Sample role" className="flex flex-wrap gap-2">
          {roles.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={role === value}
              onClick={() => setRole(value)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                role === value
                  ? "border-[var(--cg-primary)] bg-[var(--cg-background)]"
                  : "border-[var(--cg-border)] bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="w-56">
          <AppSelect
            label="Sample write result"
            value={outcome}
            onChange={(value) => {
              setOutcome(value === "permission" || value === "validation" ? value : "confirmed");
            }}
            options={[
              { value: "confirmed", label: "Confirmed" },
              { value: "permission", label: "Permission denied" },
              { value: "validation", label: "Validation error" },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(event) => setShowEmpty(event.target.checked)}
          />
          Show empty sample lists
        </label>
      </div>

      {!enabled && (
        <div className="mt-4 text-sm">Administrator actions are disabled for this sample role.</div>
      )}
      {notice && (
        <div className="mt-4" aria-live="polite">
          <div className={noticeTone === "error" ? "text-sm text-[var(--cg-error)]" : "text-sm text-[var(--cg-primary-dark)]"}>
            {notice}
          </div>
        </div>
      )}

      {section === "overview" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <AdminStatCard label="Pending approvals" value={showEmpty ? 0 : pendingAccounts.length} detail="Sample count" />
          <AdminStatCard label="Founding members" value={showEmpty ? 0 : members.length} detail="Sample count" />
          <AdminStatCard label="Open campaigns" value={showEmpty ? 0 : 1} detail="Sample count" />
          <AdminStatCard label="All campaigns" value={showEmpty ? 0 : sampleCampaigns.length} detail="Sample count" />
        </div>
      )}

      {(section === "approvals" || section === "accounts") && (
        <div className="mt-6 grid gap-3">
          {showEmpty ? (
            <AdminEmptyState title="No sample accounts" description="Empty state for the account list." />
          ) : (
            shownAccounts.map((account) => (
              <PendingAccountCard
                key={account.id}
                name={account.name}
                detail={`${account.type} · Account ${account.id}`}
                status={account.status}
                actions={accountActions(account)}
              />
            ))
          )}
        </div>
      )}

      {section === "founding" && (
        <div className="mt-6 grid gap-3">
          {showEmpty ? (
            <AdminEmptyState title="No sample founding members" description="Empty state for the waitlist." />
          ) : (
            members.map((member) => (
              <FoundingMemberCard
                key={member.id}
                name={member.name}
                details={[member.detail]}
                status={member.status}
                note={member.note}
                actions={
                  <div className="flex flex-wrap gap-2">
                    {member.status !== "invited" && (
                      <AppButton
                        isDisabled={!enabled || busy}
                        aria-label={`Invite ${member.name}`}
                        onPress={() => {
                          setReviewNote("");
                          setPending({ kind: "waitlist", id: member.id, name: member.name, status: "invited" });
                        }}
                      >
                        Invite
                      </AppButton>
                    )}
                    {member.status !== "rejected" && (
                      <AppButton
                        variant="destructive"
                        isDisabled={!enabled || busy}
                        aria-label={`Reject ${member.name}`}
                        onPress={() => {
                          setReviewNote("");
                          setPending({ kind: "waitlist", id: member.id, name: member.name, status: "rejected" });
                        }}
                      >
                        Reject
                      </AppButton>
                    )}
                  </div>
                }
              />
            ))
          )}
        </div>
      )}

      {section === "campaigns" && (
        <div className="mt-6 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div id="sample-campaign-note" className="max-w-xl text-sm">
              The administrator API can list campaigns. Status changes are unavailable on that API.
            </div>
            <AppButton variant="secondary" isDisabled aria-describedby="sample-campaign-note">
              Change status
            </AppButton>
          </div>
          {showEmpty ? (
            <AdminEmptyState title="No sample campaigns" description="Empty state for the campaign list." />
          ) : (
            sampleCampaigns.map((campaign) => (
              <AdminCampaignRow
                key={campaign.id}
                name={campaign.name}
                detail={campaign.detail}
                status={campaign.status}
              />
            ))
          )}
        </div>
      )}

      {pending && (
        <ConfirmDialog
          open
          title={pending.kind === "waitlist" ? "Update sample founding member" : pending.status === "suspended" ? "Suspend sample account" : "Approve sample account"}
          description={`Sample only. Set ${pending.name} to ${pending.status}. Nothing is sent to the server.`}
          confirmLabel="Confirm"
          confirmVariant={destructive ? "destructive" : "primary"}
          confirmDisabled={busy}
          onClose={() => {
            if (!busy) setPending(null);
          }}
          onConfirm={() => void commit()}
        >
          {pending.kind === "waitlist" && (
            <div className="mt-4">
              <AppTextarea
                label="Review note"
                value={reviewNote}
                onChange={setReviewNote}
                placeholder="Optional sample note"
                rows={3}
              />
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
