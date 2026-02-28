import type { Route } from "next";

const FLOW_CONSOLE_BASE_PATH = "/settings/flow-console";

type SearchParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function buildFlowConsolePath(
  searchParams?: SearchParamsLike
): Route {
  if (!searchParams) {
    return FLOW_CONSOLE_BASE_PATH as Route;
  }

  const params = new URLSearchParams();

  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => {
      params.append(key, value);
    });
  } else {
    for (const [key, rawValue] of Object.entries(searchParams)) {
      if (rawValue === undefined) {
        continue;
      }
      if (Array.isArray(rawValue)) {
        for (const value of rawValue) {
          params.append(key, value);
        }
        continue;
      }
      params.append(key, rawValue);
    }
  }

  const query = params.toString();
  return (query
    ? `${FLOW_CONSOLE_BASE_PATH}?${query}`
    : FLOW_CONSOLE_BASE_PATH) as Route;
}
