import { createServerFn } from "@tanstack/react-start";
import { getUberAccessToken } from "./uber/auth.server";

export type UberTrip = {
  trip_uuid: string;
  request_time: string; // ISO
  fare?: number;
  currency_code?: string;
  product_type?: string;
  employee?: { name?: string; email?: string };
  expense_code?: string | null;
  expense_memo?: string | null;
  start_address?: string | null;
  end_address?: string | null;
  city?: string | null;
  distance?: number;
  duration?: number;
};

type ApiTrip = {
  trip_id?: string;
  order_id?: string;
  trip_status?: string;
  requested_at?: number;
  start_at?: number;
  end_at?: number;
  user_info?: {
    email_address?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
  };
  client_fare?: {
    currency_code?: string;
    total?: number;
  };
};

function normalize(t: ApiTrip): UberTrip {
  const first = t.user_info?.first_name ?? "";
  const last = t.user_info?.last_name ?? "";
  const nome = `${first} ${last}`.trim() || t.user_info?.email_address || "—";
  const requestedAt = t.requested_at ? new Date(t.requested_at).toISOString() : new Date().toISOString();
  return {
    trip_uuid: t.trip_id ?? t.order_id ?? crypto.randomUUID(),
    request_time: requestedAt,
    fare: Number(t.client_fare?.total ?? 0) || 0,
    currency_code: t.client_fare?.currency_code ?? "BRL",
    product_type: "—",
    employee: { name: nome, email: t.user_info?.email_address },
    expense_code: null,
    expense_memo: null,
    start_address: null,
    end_address: null,
    city: null,
    distance: 0,
    duration: t.start_at && t.end_at ? Math.max(0, t.end_at - t.start_at) / 1000 : 0,
  };
}

export const getUberTrips = createServerFn({ method: "POST" })
  .inputValidator((input: { from: string; to: string }) => input)
  .handler(async ({ data }): Promise<{ trips: UberTrip[]; error: string | null }> => {
    try {
      const token = await getUberAccessToken("business.trips");
      const fromMs = new Date(data.from + "T00:00:00Z").getTime();
      const toMs = new Date(data.to + "T23:59:59Z").getTime();

      const trips: UberTrip[] = [];
      let pageToken: string | undefined = undefined;
      let safety = 0;

      while (safety < 200) {
        safety++;

        const body: Record<string, unknown> = {
          request: {
            search_filters: {
              user_identifiers: [],
              trip_statuses: ["PAST"],
              interval: { starts_at: fromMs, ends_at: toMs },
            },
            paging_option: {
              limit: 100,
              ...(pageToken ? { page_token: pageToken } : {}),
            },
          },
        };

        const res = await fetch("https://api.uber.com/v1/trips/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept-Language": "pt-BR",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 403) {
            return {
              trips,
              error:
                "Acesso negado pela Uber (403). Verifique no painel developer.uber.com se o app está aprovado para a API de Trips da sua organização Uber for Business.",
            };
          }
          return { trips, error: `Erro Uber (${res.status}): ${text.slice(0, 300)}` };
        }

        const json = (await res.json()) as {
          trips?: ApiTrip[];
          paging_result?: { next_page_token?: string };
        };
        const batch = json.trips ?? [];
        trips.push(...batch.map(normalize));

        const next = json.paging_result?.next_page_token;
        if (!next) break;
        pageToken = next;
      }

      return { trips, error: null };
    } catch (e) {
      console.error("getUberTrips error", e);
      return { trips: [], error: (e as Error).message };
    }
  });
