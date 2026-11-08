import { useEffect, useRef, useState } from "react";
import { getCounties, type County } from "../../api/directory";
import {
  AdminApiError,
  getAccount,
  isAbort,
  listAccounts,
  listAdminCampaigns,
  listBusinessNames,
  listWaitlist,
  type AccountSummary,
  type BusinessName,
  type CampaignQuery,
  type CampaignRecord,
  type CampaignStatus,
  type CurrentAccount,
  type WaitlistEntry,
  type WaitlistQuery,
  type WaitlistSort,
} from "../../api/admin";

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

function toMessage(error: unknown) {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error && error.message.includes("VITE_API_URL")) return error.message;
  return "Couldn't load administrator data.";
}

async function loadAccount(token: string | null, signal: AbortSignal) {
  if (!token) return null;
  try {
    return await getAccount(token, signal);
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

const hiddenRecords = "Administrator records are unavailable for this account.";

export function useAdminData(input: {
  token: string | null;
  blocked: boolean;
  preview: "loading" | "empty" | null;
  waitlistActive: boolean;
  waitlistQuery: WaitlistQuery;
  campaignActive: boolean;
  campaignQuery: CampaignQuery;
}) {
  const [retry, setRetry] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [account, setAccount] = useState<CurrentAccount | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [businesses, setBusinesses] = useState<BusinessName[]>([]);
  const [accounts, setAccounts] = useState<Resource<AccountsByStatus>>({
    status: "loading",
    message: "",
    data: emptyAccounts,
  });
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
  const loaded = useRef(false);

  useEffect(() => {
    if (input.preview) return;
    if (input.blocked) {
      setRefreshing(false);
      setRefreshError("");
      setAccount(null);
      setAccounts({ status: "error", message: hiddenRecords, data: emptyAccounts });
      setWaitlist({ status: "error", message: hiddenRecords, data: [] });
      setCampaigns({ status: "error", message: hiddenRecords, data: [] });
      setWaitlistView(null);
      setCampaignView(null);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    let ignore = false;

    async function load() {
      if (!loaded.current) {
        setAccounts({ status: "loading", message: "", data: emptyAccounts });
        setWaitlist({ status: "loading", message: "", data: [] });
        setCampaigns({ status: "loading", message: "", data: [] });
      } else {
        setRefreshing(true);
      }
      setRefreshError("");

      const countiesTask = getCounties(signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as County[];
      });
      const businessTask = listBusinessNames(signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return [] as BusinessName[];
      });

      try {
        const pending = await listAccounts(input.token, "pending", signal);
        const [approved, suspended, members, campaignRows, currentAccount, countyRows, businessRows] =
          await Promise.all([
            listAccounts(input.token, "approved", signal),
            listAccounts(input.token, "suspended", signal),
            listWaitlist(input.token, {}, signal),
            listAdminCampaigns(input.token, {}, signal),
            loadAccount(input.token, signal),
            countiesTask,
            businessTask,
          ]);
        if (ignore || signal.aborted) return;
        loaded.current = true;
        setRefreshing(false);
        setAccount(currentAccount);
        setCounties(countyRows);
        setBusinesses(businessRows);
        setAccounts({
          status: "ready",
          message: "",
          data: { pending, approved, suspended },
        });
        setWaitlist({ status: "ready", message: "", data: members });
        setCampaigns({ status: "ready", message: "", data: campaignRows });
      } catch (error) {
        if (ignore || isAbort(error)) return;
        const message = toMessage(error);
        let countyRows: County[] = [];
        let businessRows: BusinessName[] = [];
        try {
          [countyRows, businessRows] = await Promise.all([countiesTask, businessTask]);
        } catch (followError) {
          if (isAbort(followError)) return;
        }
        if (ignore || signal.aborted) return;
        setCounties(countyRows);
        setBusinesses(businessRows);
        setRefreshing(false);
        if (loaded.current) {
          setRefreshError(message);
          return;
        }
        setAccount(null);
        setAccounts({ status: "error", message, data: emptyAccounts });
        setWaitlist({ status: "error", message, data: [] });
        setCampaigns({ status: "error", message, data: [] });
      }
    }

    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [input.blocked, input.preview, input.token, retry]);

  const waitlistKey = JSON.stringify(input.waitlistQuery);
  const campaignKey = JSON.stringify(input.campaignQuery);

  useEffect(() => {
    if (input.preview || input.blocked || !input.waitlistActive) {
      setWaitlistView(null);
      return;
    }
    const controller = new AbortController();
    setWaitlistView({ status: "loading", message: "", data: [] });
    listWaitlist(input.token, input.waitlistQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setWaitlistView({ status: "ready", message: "", data });
        }
      })
      .catch((error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return;
        setWaitlistView({ status: "error", message: toMessage(error), data: [] });
      });
    return () => controller.abort();
  }, [input.blocked, input.preview, input.token, input.waitlistActive, waitlistKey, retry]);

  useEffect(() => {
    if (input.preview || input.blocked || !input.campaignActive) {
      setCampaignView(null);
      return;
    }
    const controller = new AbortController();
    setCampaignView({ status: "loading", message: "", data: [] });
    listAdminCampaigns(input.token, input.campaignQuery, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCampaignView({ status: "ready", message: "", data });
        }
      })
      .catch((error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return;
        setCampaignView({ status: "error", message: toMessage(error), data: [] });
      });
    return () => controller.abort();
  }, [input.blocked, input.preview, input.token, input.campaignActive, campaignKey, retry]);

  const loadingAccounts: Resource<AccountsByStatus> = {
    status: "loading",
    message: "",
    data: emptyAccounts,
  };
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
      refreshError: "",
      account: null,
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
      refreshError: "",
      account: null,
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
    refreshError,
    account,
    counties,
    businesses,
    accounts,
    waitlist,
    campaigns,
    waitlistView,
    campaignView,
  };
}
