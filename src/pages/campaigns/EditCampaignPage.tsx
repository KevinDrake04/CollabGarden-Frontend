import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { AppButton, AppNotice, LoadingSkeleton } from "../../components";
import { AuthError, verifiedBusinessIds } from "../../api/auth";
import { refreshSession, type Session } from "../auth/session";
import { getCounties, type County } from "../../api/directory";
import {
  CampaignApiError,
  getBusinesses,
  getCampaign,
  saveExistingCampaign,
  type Campaign,
  type CampaignInput,
  type OfferType,
} from "../../api/campaigns";
import CampaignForm, {
  campaignToFormValues,
  emptyCampaignForm,
  hasCampaignErrors,
  toDeliverableRequirements,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "./CampaignForm";

type Editor =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "wrong-role"; role: Session["role"] }
  | { status: "no-business" }
  | { status: "error"; message: string }
  | { status: "denied" }
  | { status: "not-draft"; campaignStatus: Campaign["status"] }
  | { status: "ready"; counties: County[]; businessName: string; campaign: Campaign };

function isOfferType(value: string): value is OfferType {
  return value === "gifted" || value === "dining" || value === "paid";
}

function toInput(values: CampaignFormValues): CampaignInput | null {
  const deliverableRequirements = toDeliverableRequirements(values.requirements);
  if (!isOfferType(values.offerType) || !deliverableRequirements) return null;
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    offer_type: values.offerType,
    starts_on: values.startsOn,
    ends_on: values.endsOn,
    county_ids: values.countyIds,
    deliverable_requirements: deliverableRequirements,
  };
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function failureMessage(error: unknown) {
  if (error instanceof CampaignApiError || error instanceof AuthError || error instanceof Error) {
    return error.message || "The campaign could not be saved.";
  }
  return "The campaign could not be saved.";
}

function loadFailure(error: unknown) {
  if (error instanceof CampaignApiError) {
    if (error.status === 403) return "You do not have permission to edit this campaign.";
    if (error.status === 404) {
      return "This draft could not be found, or this account cannot open it.";
    }
    return error.message || "This draft could not be loaded.";
  }
  if (error instanceof AuthError || error instanceof Error) {
    return error.message || "This draft could not be loaded.";
  }
  return "This draft could not be loaded.";
}

function savedMessage(campaign: Campaign) {
  const name = campaign.name.trim() || "This campaign";
  if (campaign.status === "draft") {
    return `${name} was saved as a draft. It is not listed publicly.`;
  }
  if (campaign.status === "open") {
    return `${name} was published and is open for discovery.`;
  }
  return `${name} was saved with status ${campaign.status}.`;
}

function partialMessage(campaign: Campaign, target: "draft" | "open", detail: string) {
  const name = campaign.name.trim() || "This campaign";
  return `${name} was saved with status ${campaign.status}. Changing it to ${target} failed: ${detail}`;
}

function roleNotice(role: Session["role"]) {
  if (role === "creator") {
    return "Creator accounts cannot edit campaigns. Use a business account that owns this draft.";
  }
  if (role === "admin") return "Administrator accounts cannot edit campaigns.";
  return "This account cannot edit campaigns.";
}

function notDraftMessage(status: Campaign["status"]) {
  if (status === "open") return "This campaign is already open, so it cannot be edited as a draft.";
  if (status === "closed") return "This campaign is closed, so it cannot be edited as a draft.";
  return "This campaign is not an editable draft.";
}

async function loadCounties(signal: AbortSignal) {
  try {
    const counties = await getCounties(signal);
    if (signal.aborted) return [];
    if (counties.length === 0) {
      throw new Error("Couldn't load counties, so this draft cannot be edited yet.");
    }
    return counties;
  } catch (error) {
    if (isAbort(error) || signal.aborted) throw error;
    if (error instanceof Error && error.message.startsWith("Couldn't load counties")) throw error;
    throw new Error("Couldn't load counties, so this draft cannot be edited yet.");
  }
}

async function loadBusinessName(businessId: number, signal: AbortSignal) {
  try {
    const businesses = await getBusinesses(signal);
    const name = businesses.find((business) => business.business_id === businessId)?.name.trim();
    return name || `Business ${businessId}`;
  } catch (error) {
    if (isAbort(error) || signal.aborted) throw error;
    return `Business ${businessId}`;
  }
}

export default function EditCampaignPage() {
  const params = useParams();
  const campaignId = Number(params.campaignId);
  const idIsValid = Number.isInteger(campaignId) && campaignId > 0;
  const idKey = idIsValid ? String(campaignId) : params.campaignId ?? "";
  const [seenKey, setSeenKey] = useState(idKey);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<Editor>({ status: "loading" });
  const [values, setValues] = useState<CampaignFormValues>(emptyCampaignForm);
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [submitting, setSubmitting] = useState<"draft" | "open" | null>(null);
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState<Campaign | null>(null);
  const request = useRef<AbortController | null>(null);
  const campaignRef = useRef<Campaign | null>(null);
  const publishedRef = useRef(false);

  if (seenKey !== idKey) {
    setSeenKey(idKey);
    setEditor({ status: "loading" });
    setValues(emptyCampaignForm());
    setErrors({});
    setApiError("");
    setSaved(null);
    setSubmitting(null);
  }

  const view: Editor = seenKey === idKey ? editor : { status: "loading" };
  const ready = view.status === "ready" ? view : null;
  campaignRef.current = ready?.campaign ?? null;
  publishedRef.current = ready?.campaign.status === "open";

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (!idIsValid) return;
    const controller = new AbortController();
    setEditor({ status: "loading" });
    setApiError("");
    setSaved(null);

    async function load() {
      try {
        const session = await refreshSession(controller.signal);
        if (controller.signal.aborted) return;
        if (!session) {
          setEditor({ status: "signed-out" });
          return;
        }
        if (session.role !== "business") {
          setEditor({ status: "wrong-role", role: session.role });
          return;
        }
        const businessIds = verifiedBusinessIds(session);
        if (businessIds.length === 0) {
          setEditor({ status: "no-business" });
          return;
        }

        const campaign = await getCampaign(campaignId, session.accessToken, controller.signal);
        if (controller.signal.aborted) return;
        if (!businessIds.includes(campaign.business_id)) {
          setEditor({ status: "denied" });
          return;
        }
        if (campaign.status !== "draft") {
          setEditor({ status: "not-draft", campaignStatus: campaign.status });
          return;
        }

        const [counties, businessName] = await Promise.all([
          loadCounties(controller.signal),
          loadBusinessName(campaign.business_id, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setValues(campaignToFormValues(campaign));
        setErrors({});
        setEditor({ status: "ready", counties, businessName, campaign });
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof CampaignApiError && error.status === 401) {
          setEditor({ status: "signed-out" });
          return;
        }
        if (error instanceof AuthError && error.status === 401) {
          setEditor({ status: "signed-out" });
          return;
        }
        setEditor({ status: "error", message: loadFailure(error) });
      }
    }

    load();
    return () => controller.abort();
  }, [campaignId, idIsValid, retry]);

  async function submit(target: "draft" | "open") {
    const current = campaignRef.current;
    if (!current || current.status !== "draft") return;
    const existingId = current.campaign_id;
    const businessId = current.business_id;

    const nextErrors = validateCampaignForm(values);
    setErrors(nextErrors);
    setApiError("");
    setSaved(null);
    if (hasCampaignErrors(nextErrors)) return;

    const input = toInput(values);
    if (!input) {
      setErrors(validateCampaignForm(values));
      return;
    }

    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setSubmitting(target);

    try {
      const fresh = await refreshSession(controller.signal);
      if (controller.signal.aborted) return;
      if (!fresh) {
        setApiError("Sign in with a business account before saving or publishing.");
        return;
      }
      if (fresh.role !== "business") {
        setApiError("This account cannot edit campaigns.");
        return;
      }
      const businessIds = verifiedBusinessIds(fresh);
      if (!businessIds.includes(businessId)) {
        setApiError("This account cannot edit a campaign for that business.");
        return;
      }

      const campaign = await saveExistingCampaign({
        campaignId: existingId,
        input,
        target,
        token: fresh.accessToken,
        includeRequirements: true,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (campaign.campaign_id !== existingId) {
        setApiError("The server did not update this campaign.");
        return;
      }
      setEditor((editorState) => (
        editorState.status === "ready" ? { ...editorState, campaign } : editorState
      ));
      if (campaign.status !== target) {
        setApiError(partialMessage(
          campaign,
          target,
          "The campaign status did not match the requested status.",
        ));
        return;
      }
      setSaved(campaign);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      if (error instanceof CampaignApiError && error.campaign?.campaign_id === existingId) {
        const kept = error.campaign;
        setEditor((editorState) => (
          editorState.status === "ready" ? { ...editorState, campaign: kept } : editorState
        ));
        setApiError(partialMessage(kept, target, error.message));
        return;
      }
      if (error instanceof AuthError && error.status === 401) {
        setApiError("Sign in with a business account before saving or publishing.");
        return;
      }
      setApiError(failureMessage(error));
    } finally {
      if (!controller.signal.aborted) setSubmitting(null);
    }
  }

  const published = ready?.campaign.status === "open";
  const banner = (
    <div className="space-y-3">
      {apiError && (
        <AppNotice tone="error" message={apiError} onClose={() => setApiError("")} />
      )}
      {saved && (
        <AppNotice tone="success" message={savedMessage(saved)} onClose={() => setSaved(null)} />
      )}
      {published && (
        <Link
          to="/campaigns"
          className="inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          View open campaigns
        </Link>
      )}
    </div>
  );

  return (
    <div className="-m-12 min-h-[calc(100dvh-4.5rem)] bg-[#f8f8f0] max-[700px]:-mx-5 max-[700px]:-my-8">
      <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10 text-[var(--cg-text)] md:px-8 md:py-14">
        <Link
          to="/dashboard/business#campaigns"
          className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          My Campaigns
        </Link>
        <div className="mt-4 max-w-2xl">
          <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
            Edit draft
          </h1>
          <p className="mt-3 text-base">
            {published
              ? "This campaign was published and is open for discovery."
              : "Update this saved draft, then save it or publish it. Saving and publishing update this campaign."}
          </p>
        </div>

        {!idIsValid && (
          <div className="mt-6">
            <AppNotice tone="error" message="This campaign link is not valid." />
          </div>
        )}

        {idIsValid && view.status === "loading" && (
          <div className="mt-8 space-y-4" aria-label="Loading draft">
            <LoadingSkeleton lines={4} />
            <LoadingSkeleton lines={2} />
          </div>
        )}

        {idIsValid && view.status === "signed-out" && (
          <div className="mt-6 space-y-3">
            <AppNotice
              tone="info"
              message="Sign in with a business account to edit this draft."
            />
            <Link
              to="/login"
              state={{ from: `/campaigns/${campaignId}/edit` }}
              className="inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Log in
            </Link>
          </div>
        )}

        {idIsValid && view.status === "wrong-role" && (
          <div className="mt-6">
            <AppNotice tone="info" message={roleNotice(view.role)} />
          </div>
        )}

        {idIsValid && view.status === "no-business" && (
          <div className="mt-6">
            <AppNotice
              tone="info"
              message="This account is not linked to a business, so this draft cannot be edited."
            />
          </div>
        )}

        {idIsValid && view.status === "denied" && (
          <div className="mt-6">
            <AppNotice
              tone="error"
              message="This campaign belongs to a business this account cannot manage."
            />
          </div>
        )}

        {idIsValid && view.status === "not-draft" && (
          <div className="mt-6 space-y-3">
            <AppNotice tone="error" message={notDraftMessage(view.campaignStatus)} />
            {view.campaignStatus === "open" && (
              <Link
                to="/campaigns"
                className="inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
              >
                View open campaigns
              </Link>
            )}
          </div>
        )}

        {idIsValid && view.status === "error" && (
          <div className="mt-6 space-y-3">
            <AppNotice tone="error" message={view.message} />
            <AppButton
              variant="secondary"
              onPress={() => {
                setEditor({ status: "loading" });
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </AppButton>
          </div>
        )}

        {seenKey === idKey && ready && ready.campaign.campaign_id === campaignId && (
          <>
            <p className="mt-6 text-sm">
              {published
                ? `This campaign belongs to ${ready.businessName}.`
                : `This draft belongs to ${ready.businessName}.`}
            </p>
            <div className="mt-8">
              <CampaignForm
                variant="page"
                values={values}
                errors={errors}
                counties={ready.counties}
                submitting={submitting}
                actionsDisabled={ready.campaign.status !== "draft"}
                requirementsLocked={ready.campaign.status !== "draft"}
                banner={apiError || saved || published ? banner : null}
                onChange={(next) => {
                  setValues(next);
                  setErrors({});
                  if (!publishedRef.current) {
                    setApiError("");
                    setSaved(null);
                  }
                }}
                onSaveDraft={() => submit("draft")}
                onPublish={() => submit("open")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
