const KIND: Record<string, string> = { expense: "PV", income: "MR", investment: "MR", withdrawal: "WV", transfer: "TV" };
export const docNo = (type: string, n: number | null | undefined) => `${KIND[type] ?? "DOC"}-${String(n ?? 0).padStart(4, "0")}`;
export const invoiceNo = (orderNo: string) => `INV-${orderNo.replace(/^#/, "")}`;
