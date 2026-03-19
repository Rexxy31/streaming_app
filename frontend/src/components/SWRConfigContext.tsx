"use client";

import { ReactNode } from "react";
import { SWRConfig } from "swr";

export default function SWRConfigContext({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        dedupingInterval: 10000, // 10 seconds deduping
        focusThrottleInterval: 30000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
