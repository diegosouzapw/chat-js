"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { buildFlowConsolePath } from "@/lib/flow/build-flow-console-path";

export default function FlowPageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    router.replace(buildFlowConsolePath(searchParams));
  }, [router, queryString, searchParams]);

  return null;
}
