"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Alert } from "@/ui";

type NoticeContext = { notice?: string; setNotice: (message: string | undefined) => void };

const Context = createContext<NoticeContext>({ setNotice: () => {} });

/** Lets a row set a one-sentence page message, for example after a refused edit. */
export function useNotice() {
  return useContext(Context);
}

/** The page body: a column that shares the notice with the banner and the rows. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<string>();
  return (
    <Context.Provider value={{ notice, setNotice }}>
      <div className="flex flex-col gap-6">{children}</div>
    </Context.Provider>
  );
}

/** Shows the current notice; place it under the PageHeader. */
export function NoticeBanner() {
  const { notice } = useNotice();
  return notice ? <Alert tone="warning">{notice}</Alert> : null;
}
