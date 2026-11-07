import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AppButton, AppNotice, AppSelect, LoadingSkeleton } from "../../components";
import { AuthError, verifiedBusinessIds } from "../../api/auth";
import { readSession, refreshSession, watchSession, type Session } from "../auth/session";
import { getCounties, type County } from "../../api/directory";
import {
  CampaignApiError,
  getBusinesses,
  submitCampaign,
  type Campaign,
  type CampaignInput,
  type OfferType,
} from "../../api/campaigns";
import CampaignForm, {
  emptyCampaignForm,
  hasCampaignErrors,
  toDeliverableRequirements,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from "./CampaignForm";

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

function partialMessage(campaign: Campaign, target: "draft" | "open", detail: string, created: boolean) {
  const verb = created ? "created" : "saved";
  return `${campaign.name} was ${verb} with status ${campaign.status}. Changing it to ${target} failed: ${detail}`;
}

function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function NewCampaignPage() {
  const [counties, setCounties] = useState<County[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [values, setValues] = useState(emptyCampaignForm);
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [submitting, setSubmitting] = useState<"draft" | "open" | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [requirementsLocked, setRequirementsLocked] = useState(false);
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState<Campaign | null>(null);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [accountCheck, setAccountCheck] = useState<"pending" | "ready" | "error">(
    () => (readSession() ? "pending" : "ready"),
  );
  const [accountError, setAccountError] = useState("");
  const [accountAttempt, setAccountAttempt] = useState(0);
  const [businessNames, setBusinessNames] = useState<Map<number, string>>(() => new Map());
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [businessError, setBusinessError] = useState("");
  const request = useRef<AbortController | null>(null);

  const businessIds = session?.role === "business" ? verifiedBusinessIds(session) : [];
  const businessKey = businessIds.join(",");

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

  useEffect(() => {
    const controller = new AbortController();
    const stored = readSession();
    if (!stored) {
      setAccountCheck("ready");
      setAccountError("");
      return () => controller.abort();
    }

    setAccountCheck("pending");
    setAccountError("");
    refreshSession(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setAccountCheck("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        if (error instanceof AuthError && error.status === 401) {
          setAccountCheck("ready");
          return;
        }
        setAccountCheck("error");
        setAccountError(failureMessage(error));
      });
    return () => controller.abort();
  }, [accountAttempt]);

  useEffect(() => {
    if (!session || session.role !== "business") {
      setSelectedBusinessId(null);
      return;
    }
    const ids = verifiedBusinessIds(session);
    setSelectedBusinessId((current) => {
      if (ids.length === 1) return ids[0];
      if (current != null && ids.includes(current)) return current;
      if (session.businessId != null && ids.includes(session.businessId)) return session.businessId;
      return null;
    });
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== "business" || !businessKey) return;
    const ids = businessKey.split(",").map(Number);
    const controller = new AbortController();
    getBusinesses(controller.signal)
      .then((businesses) => {
        const names = new Map<number, string>();
        for (const business of businesses) {
          if (ids.includes(business.business_id) && business.name.trim()) {
            names.set(business.business_id, business.name.trim());
          }
        }
        setBusinessNames(names);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setBusinessNames(new Map());
      });
    return () => controller.abort();
  }, [session, businessKey]);

  useEffect(() => () => request.current?.abort(), []);

  function businessLabel(id: number) {
    return businessNames.get(id) ?? `Business ${id}`;
  }

  function remember(campaign: Campaign) {
    setCampaignId(campaign.campaign_id);
    if (campaign.status === "open") setRequirementsLocked(true);
  }

  async function submit(target: "draft" | "open") {
    const nextErrors = validateCampaignForm(values);
    setErrors(nextErrors);
    setApiError("");
    setSaved(null);
    setBusinessError("");
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
    const existed = campaignId != null;

    try {
      const fresh = await refreshSession(controller.signal);
      if (controller.signal.aborted) return;
      if (!fresh) {
        setApiError("Sign in with a business account before saving or publishing.");
        return;
      }
      if (fresh.role !== "business") {
        setApiError("Creator accounts cannot post campaigns.");
        return;
      }

      const ids = verifiedBusinessIds(fresh);
      const businessId = ids.length === 1
        ? ids[0]
        : selectedBusinessId != null && ids.includes(selectedBusinessId)
          ? selectedBusinessId
          : null;
      if (ids.length === 0) {
        setApiError("This account is not linked to a business, so the campaign was not sent.");
        return;
      }
      if (businessId == null) {
        setBusinessError("Select which business is creating this campaign.");
        return;
      }

      const campaign = await submitCampaign({
        input,
        target,
        token: fresh.accessToken,
        businessId,
        campaignId,
        includeRequirements: !requirementsLocked,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      remember(campaign);
      if (campaign.status !== target) {
        setApiError(partialMessage(
          campaign,
          target,
          "The campaign status did not match the requested status.",
          !existed,
        ));
        return;
      }
      setSaved(campaign);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      if (error instanceof CampaignApiError && error.campaign) {
        remember(error.campaign);
        setApiError(partialMessage(error.campaign, target, error.message, !existed));
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

  const actionsDisabled = session != null && (
    accountCheck !== "ready"
    || session.role !== "business"
    || businessIds.length === 0
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
        {session && accountCheck === "pending" && (
          <p className="mt-6 text-sm">Checking this account...</p>
        )}
        {accountCheck === "error" && (
          <div className="mt-6 space-y-3">
            <AppNotice tone="error" message={accountError || "Couldn't confirm this account."} />
            <AppButton variant="secondary" onPress={() => setAccountAttempt((value) => value + 1)}>
              Try again
            </AppButton>
          </div>
        )}
        {session?.role === "business" && accountCheck === "ready" && businessIds.length === 0 && (
          <div className="mt-6">
            <AppNotice
              tone="info"
              message="This account is not linked to a business, so a campaign cannot be saved or published."
            />
          </div>
        )}
        {session?.role === "business" && accountCheck === "ready" && businessIds.length === 1 && (
          <p className="mt-6 text-sm">
            This campaign will be created for {businessLabel(businessIds[0])}.
          </p>
        )}
        {session?.role === "business" && accountCheck === "ready" && businessIds.length > 1 && (
          <div className="mt-6 max-w-md">
            <AppSelect
              label="Business"
              name="campaign-business"
              value={selectedBusinessId == null ? "" : String(selectedBusinessId)}
              onChange={(value) => {
                const id = Number(value);
                setSelectedBusinessId(businessIds.includes(id) ? id : null);
                setBusinessError("");
              }}
              options={businessIds.map((id) => ({ value: String(id), label: businessLabel(id) }))}
              placeholder="Select a business"
              helper="Choose which business is creating this campaign."
              error={businessError}
              required
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
              actionsDisabled={actionsDisabled}
              requirementsLocked={requirementsLocked}
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
