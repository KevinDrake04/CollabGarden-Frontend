import { useEffect, useRef, useState } from "react";
import { getCounties, type County } from "../../api/directory";
import {
  AdminApiError,
  isAbort,
  listAccounts,
  listAdminCampaigns,
  listBusinessNames,
  listWaitlist,
  type AccountSummary,
  type BusinessName,
  type CampaignQuery,
  type CampaignRecord,
  type WaitlistEntry,
  type WaitlistQuery,
} from "../../api/admin";
import { clearSession } from "../auth/session";

export type Resource<T> = {
  status: "loading" | "ready" | "error";
  message: string;
  data: T;
};

export type AccountsByStatus = {
  pending: AccountSummary[];
  approved: AccountSummary[];
  suspended: AccountSummary[];
};

const emptyAccounts: AccountsByStatus = {
  pending: [],
  approved: [],
  suspended: [],
};

const loadingAccounts: Resource<AccountsByStatus> = {
  status: "loading",
  message: "",
  data: emptyAccounts,
};

function toMessage(error: unknown) {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error && error.message.includes("VITE_API_URL")) return error.message;
  return "Couldn't load administrator data.";
}

function isUnauthorized(error: unknown) {
  return error instanceof AdminApiError && error.status === 401;
}

export function useAdminData(input: {
  token: string | null;
  enabled: boolean;
  preview: "loading" | "empty" | null;
  waitlistActive: boolean;
  waitlistQuery: WaitlistQuery;
  campaignActive: boolean;
  campaignQuery: CampaignQuery;
}) {
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [accountRefreshError, setAccountRefreshError] = useState("");
  const [waitlistRefreshError, setWaitlistRefreshError] = useState("");
  const [campaignRefreshError, setCampaignRefreshError] = useState("");
  const [counties, setCounties] = useState<County[]>([]);
  const [businesses, setBusinesses] = useState<BusinessName[]>([]);
  const [accounts, setAccounts] = useState<Resource<AccountsByStatus>>(loadingAccounts);
  const [waitlist, setWaitlist] = useState<Resource<WaitlistEntry[]>>({
    status: "loading",
    message: "",
    data: [],
  });
  const [campaigns, setCampaigns] = useState<Resource<CampaignRecord[]>>({
    status: "loading",
    message: "",
    data: [],
  });
  const [waitlistView, setWaitlistView] = useState<Resource<WaitlistEntry[]> | null>(null);
  const [campaignView, setCampaignView] = useState<Resource<CampaignRecord[]> | null>(null);
  const accountsReady = useRef(false);
  const waitlistReady = useRef(false);
  const campaignsReady = useRef(false);
  const runId = useRef(0);

  useEffect(() => {
    const run = ++runId.current;
    if (input.preview) return;
    if (!input.enabled || !input.token) {
      accountsReady.current = false;
      waitlistReady.current = false;
      campaignsReady.current = false;
      setRefreshing(false);
      setAccountRefreshError("");
      setWaitlistRefreshError("");
      setCampaignRefreshError("");
      setAccounts(loadingAccounts);
      setWaitlist({ status: "loading", message: "", data: [] });
      setCampaigns({ status: "loading", message: "", data: [] });
      setWaitlistView(null);
      setCampaignView(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const token = input.token;
    let ignore = false;
    let expired = false;
    let open = 3;
    if (accountsReady.current || waitlistReady.current || campaignsReady.current) {
      setRefreshing(true);
    }

    function finished() {
      open -= 1;
      if (open === 0 && run === runId.current) setRefreshing(false);
    }

    function fail<T>(
      error: unknown,
      ready: { current: boolean },
      setRefreshError: (message: string) => void,
      setResource: (resource: Resource<T>) => void,
      empty: T,
    ) {
      if (ignore || signal.aborted || isAbort(error) || expired) return;
      if (isUnauthorized(error)) {
        expired = true;
        clearSession();
        return;
      }
      const message = toMessage(error);
      if (ready.current) setRefreshError(message);
      else setResource({ status: "error", message, data: empty });
    }

    if (!accountsReady.current) setAccounts(loadingAccounts);
    setAccountRefreshError("");
    Promise.all([
      listAccounts(token, "pending", signal),
      listAccounts(token, "approved", signal),
      listAccounts(token, "suspended", signal),
    ])
      .then(([pending, approved, suspended]) => {
        if (ignore || signal.aborted || expired) return;
        accountsReady.current = true;
        setAccounts({ status: "ready", message: "", data: { pending, approved, suspended } });
      })
      .catch((error: unknown) => {
        fail(error, accountsReady, setAccountRefreshError, setAccounts, emptyAccounts);
      })
      .finally(finished);

    if (!waitlistReady.current) setWaitlist({ status: "loading", message: "", data: [] });
    setWaitlistRefreshError("");
    listWaitlist(token, {}, signal)
      .then((data) => {
        if (ignore || signal.aborted || expired) return;
        waitlistReady.current = true;
        setWaitlist({ status: "ready", message: "", data });
      })
      .catch((error: unknown) => {
        fail(error, waitlistReady, setWaitlistRefreshError, setWaitlist, []);
      })
      .finally(finished);

    if (!campaignsReady.current) setCampaigns({ status: "loading", message: "", data: [] });
    setCampaignRefreshError("");
    listAdminCampaigns(token, {}, signal)
      .then((data) => {
        if (ignore || signal.aborted || expired) return;
        campaignsReady.current = true;
        setCampaigns({ status: "ready", message: "", data });
      })
      .catch((error: unknown) => {
        fail(error, campaignsReady, setCampaignRefreshError, setCampaigns, []);
      })
      .finally(finished);

    const countiesTask = getCounties(signal).catch((error: unknown) => {
      if (isAbort(error)) throw error;
      return [] as County[];
    });
    const businessTask = listBusinessNames(signal).catch((error: unknown) => {
      if (isAbort(error)) throw error;
      return [] as BusinessName[];
    });
    Promise.all([countiesTask, businessTask])
      .then(([countyRows, businessRows]) => {
        if (ignore || signal.aborted || expired) return;
        setCounties(countyRows);
        setBusinesses(businessRows);
      })
      .catch((error: unknown) => {
        if (ignore || isAbort(error) || expired) return;
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [input.enabled, input.preview, input.token, retry]);

  useEffect(() => {
    if (input.preview || !input.enabled || !input.token || !input.waitlistActive) {
      setWaitlistView(null);
      return;
    }
    const controller = new AbortController();
    const token = input.token;
    setWaitlistView({ status: "loading", message: "", data: [] });
    listWaitlist(token, input.waitlistQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setWaitlistView({ status: "ready", message: "", data });
      })
      .catch((error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return;
        if (isUnauthorized(error)) {
          clearSession();
          return;
        }
        setWaitlistView({ status: "error", message: toMessage(error), data: [] });
      });
    return () => controller.abort();
  }, [input.enabled, input.preview, input.token, input.waitlistActive, input.waitlistQuery, retry]);

  useEffect(() => {
    if (input.preview || !input.enabled || !input.token || !input.campaignActive) {
      setCampaignView(null);
      return;
    }
    const controller = new AbortController();
    const token = input.token;
    setCampaignView({ status: "loading", message: "", data: [] });
    listAdminCampaigns(token, input.campaignQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCampaignView({ status: "ready", message: "", data });
      })
      .catch((error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return;
        if (isUnauthorized(error)) {
          clearSession();
          return;
        }
        setCampaignView({ status: "error", message: toMessage(error), data: [] });
      });
    return () => controller.abort();
  }, [input.enabled, input.preview, input.token, input.campaignActive, input.campaignQuery, retry]);

  const readyAccounts: Resource<AccountsByStatus> = {
    status: "ready",
    message: "",
    data: emptyAccounts,
  };
  const readyList = <T,>(data: T): Resource<T> => ({ status: "ready", message: "", data });

  if (input.preview === "loading") {
    return {
      reload: () => setRetry((value) => value + 1),
      refreshing: false,
      accountRefreshError: "",
      waitlistRefreshError: "",
      campaignRefreshError: "",
      counties,
      businesses,
      accounts: loadingAccounts,
      waitlist: { status: "loading" as const, message: "", data: [] },
      campaigns: { status: "loading" as const, message: "", data: [] },
      waitlistView: null,
      campaignView: null,
    };
  }

  if (input.preview === "empty") {
    return {
      reload: () => setRetry((value) => value + 1),
      refreshing: false,
      accountRefreshError: "",
      waitlistRefreshError: "",
      campaignRefreshError: "",
      counties,
      businesses,
      accounts: readyAccounts,
      waitlist: readyList<WaitlistEntry[]>([]),
      campaigns: readyList<CampaignRecord[]>([]),
      waitlistView: null,
      campaignView: null,
    };
  }

  return {
    reload: () => setRetry((value) => value + 1),
    refreshing,
    accountRefreshError,
    waitlistRefreshError,
    campaignRefreshError,
    counties,
    businesses,
    accounts,
    waitlist,
    campaigns,
    waitlistView,
    campaignView,
  };
}
