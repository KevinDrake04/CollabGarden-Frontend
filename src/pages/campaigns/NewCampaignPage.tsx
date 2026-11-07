import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice, LoadingSkeleton } from "../../components";
import { readSession, watchSession, type Session } from "../auth/session";
import { getCounties, type County } from "../directory/api";
import {
  CampaignApiError,
  submitCampaign,
  type Campaign,
  type CampaignInput,
  type OfferType,
} from "./api";
import CampaignForm, {
  emptyCampaignForm,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "./CampaignForm";

function isOfferType(value: string): value is OfferType {
  return value === "gifted" || value === "dining" || value === "paid";
}

function toInput(values: CampaignFormValues): CampaignInput | null {
  if (!isOfferType(values.offerType)) return null;
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    offer_type: values.offerType,
    starts_on: values.startsOn,
    ends_on: values.endsOn,
    county_ids: values.countyIds,
  };
}

function failureMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "The campaign could not be saved.";
}

function savedMessage(campaign: Campaign) {
  if (campaign.status === "draft") {
    return `${campaign.name} was saved as a draft. It is not listed publicly.`;
  }
  if (campaign.status === "open") {
    return `${campaign.name} was published and is open for discovery.`;
  }
  return `${campaign.name} was saved with status ${campaign.status}.`;
}

function partialMessage(campaign: Campaign, target: "draft" | "open", detail: string) {
  const intended = target === "open" ? "open" : "draft";
  return `${campaign.name} was created with status ${campaign.status}. Changing it to ${intended} failed: ${detail}`;
}

export default function NewCampaignPage() {
  const [counties, setCounties] = useState<County[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [values, setValues] = useState(emptyCampaignForm);
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [submitting, setSubmitting] = useState<"draft" | "open" | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState<Campaign | null>(null);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus("loading");
    getCounties(controller.signal)
      .then((data) => {
        setCounties(data);
        setLoadStatus(data.length === 0 ? "error" : "ready");
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadStatus("error");
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => watchSession(() => setSession(readSession())), []);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(target: "draft" | "open") {
    const nextErrors = validateCampaignForm(values);
    setErrors(nextErrors);
    setApiError("");
    setSaved(null);
    if (Object.keys(nextErrors).length > 0) return;

    const input = toInput(values);
    if (!input) {
      setErrors({ offerType: "Select gifted, dining, or paid." });
      return;
    }

    if (!session) {
      setApiError("Sign in with a business account before saving or publishing.");
      return;
    }
    if (session.role !== "business") {
      setApiError("Creator accounts cannot post campaigns.");
      return;
    }
    if (session.businessId == null) {
      setApiError("This account did not include a business id, so the campaign was not sent.");
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setSubmitting(target);
    try {
      const campaign = await submitCampaign({
        input,
        target,
        token: session.accessToken,
        businessId: session.businessId,
        campaignId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setCampaignId(campaign.campaign_id);
      if (campaign.status !== target) {
        setApiError(partialMessage(campaign, target, "The campaign status did not match the requested status."));
        return;
      }
      setSaved(campaign);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof CampaignApiError && error.campaign) {
        setCampaignId(error.campaign.campaign_id);
        setApiError(partialMessage(error.campaign, target, error.message));
        return;
      }
      setApiError(failureMessage(error));
    } finally {
      if (!controller.signal.aborted) setSubmitting(null);
    }
  }

  const banner = (
    <div className="space-y-3">
      {apiError && (
        <AppNotice tone="error" message={apiError} onClose={() => setApiError("")} />
      )}
      {saved && (
        <AppNotice tone="success" message={savedMessage(saved)} onClose={() => setSaved(null)} />
      )}
      {saved?.status === "open" && (
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
          to="/campaigns"
          className="text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
        >
          All campaigns
        </Link>
        <div className="mt-4 max-w-2xl">
          <h1 className="font-bold tracking-tight text-[var(--cg-primary-dark)]">
            Post a campaign
          </h1>
          <p className="mt-3 text-base">
            Tell creators what you need, where the collaboration runs, and when it happens.
          </p>
        </div>

        {!session && (
          <div className="mt-6 space-y-3">
            <AppNotice
              tone="info"
              message="Sign in with a business account to save a draft or publish."
            />
            <Link
              to="/login"
              state={{ from: "/campaigns/new" }}
              className="inline-flex text-sm font-semibold text-[var(--cg-primary-dark)] no-underline"
            >
              Log in
            </Link>
          </div>
        )}
        {session?.role === "creator" && (
          <div className="mt-6">
            <AppNotice
              tone="info"
              message="Creator accounts cannot post campaigns. Use a business account to save or publish."
            />
          </div>
        )}
        {session?.role === "business" && session.businessId == null && (
          <div className="mt-6">
            <AppNotice
              tone="info"
              message="You are signed in, but CollabGarden did not return a business id for this account. The campaign cannot be sent."
            />
          </div>
        )}

        <div className="mt-8">
          {loadStatus === "loading" ? (
            <div className="space-y-4" aria-label="Loading campaign form">
              <LoadingSkeleton lines={4} />
              <LoadingSkeleton lines={2} />
            </div>
          ) : loadStatus === "error" ? (
            <div role="alert" className="space-y-3">
              <AppNotice tone="error" message="Couldn't load counties. Please try again." />
              <AppButton variant="secondary" onPress={() => setRetry((value) => value + 1)}>
                Try again
              </AppButton>
            </div>
          ) : (
            <CampaignForm
              variant="page"
              values={values}
              errors={errors}
              counties={counties}
              submitting={submitting}
              actionsDisabled={session != null && (session.role !== "business" || session.businessId == null)}
              banner={apiError || saved ? banner : null}
              onChange={(next) => {
                setValues(next);
                setErrors({});
                setApiError("");
                setSaved(null);
              }}
              onSaveDraft={() => submit("draft")}
              onPublish={() => submit("open")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
