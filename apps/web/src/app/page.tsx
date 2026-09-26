"use client";

import { useEffect, useState } from "react";

const BUSINESS_ID = "c18a60a6-4c69-4e4f-89a5-16539b8b946d";
const API_URL = "http://localhost:3001";

type Dashboard = {
  business: {
    id: string;
    name: string;
    email: string | null;
    country: string;
    defaultCurrency: string;
  };
  stats: {
    customers: number;
    invoices: number;
    payments: number;
    reconciledPayments: number;
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    currency: string;
  };
  customers: Array<{
    id: string;
    name: string;
    email: string | null;
    companyName: string | null;
    country: string | null;
    status: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    description: string | null;
    currency: string;
    totalAmount: string;
    amountPaid: string;
    status: string;
    customerId: string;
    issuedAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    method: string | null;
    internalReference: string;
    invoiceId: string | null;
    paidAt: string | null;
  }>;
  reconciliations: Array<{
    id: string;
    paymentId: string;
    invoiceId: string | null;
    status: string;
    matchType: string | null;
    confidence: string | null;
    reason: string | null;
  }>;
};

function formatMoney(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function shortReference(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 14)}…`;
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/dashboard/${BUSINESS_ID}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Unable to load dashboard");
      }

      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to BorderPay API",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f8f7] p-6 text-slate-900 md:p-10">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-8">
            <div className="h-10 w-48 rounded-lg bg-slate-200" />
            <div className="grid gap-5 md:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-32 rounded-2xl bg-white shadow-sm" />
              ))}
            </div>
            <div className="h-96 rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8f7] p-6">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            !
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            BorderPay is offline
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || "Could not load dashboard data."}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              loadDashboard();
            }}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const { business, stats, customers, invoices, payments, reconciliations } =
    dashboard;

  const customerById = new Map(
    customers.map((customer) => [customer.id, customer]),
  );

  const invoiceById = new Map(
    invoices.map((invoice) => [invoice.id, invoice]),
  );

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">
              B
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">
                Border<span className="text-emerald-600">Pay</span>
              </div>
              <div className="text-xs text-slate-400">
                Cross-border payments & reconciliation
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live
            </div>
            <button
              onClick={() => {
                setLoading(true);
                loadDashboard();
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
        <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-600">
              Business overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {business.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {business.email} · {business.country} ·{" "}
              {business.defaultCurrency}
            </p>
          </div>

          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700">
            + Create invoice
          </button>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Total invoiced
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                ↗
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {formatMoney(stats.totalInvoiced, stats.currency)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {stats.invoices} invoice{stats.invoices === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Total received
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                ✓
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {formatMoney(stats.totalPaid, stats.currency)}
            </div>
            <p className="mt-2 text-xs text-emerald-600">
              Payments successfully received
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Outstanding
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                $
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {formatMoney(stats.outstanding, stats.currency)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Current receivables
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                Reconciled
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                ⌁
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {stats.reconciledPayments}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Matched payment{stats.reconciledPayments === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="font-bold">Invoices</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Track invoices and payment status
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {invoices.length} total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-4 font-semibold">Invoice</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const customer = customerById.get(invoice.customerId);

                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-6 py-5">
                          <div className="font-semibold text-slate-800">
                            {invoice.invoiceNumber}
                          </div>
                          <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                            {invoice.description || "No description"}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="font-medium text-slate-700">
                            {customer?.companyName ||
                              customer?.name ||
                              "Customer"}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {customer?.country || "—"}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="font-semibold">
                            {formatMoney(
                              Number(invoice.totalAmount),
                              invoice.currency,
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Paid{" "}
                            {formatMoney(
                              Number(invoice.amountPaid),
                              invoice.currency,
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              invoice.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700"
                                : invoice.status === "PARTIALLY_PAID"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {invoice.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="font-bold">Payment activity</h2>
              <p className="mt-1 text-xs text-slate-400">
                Latest incoming payments
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {payments.map((payment) => {
                const invoice = payment.invoiceId
                  ? invoiceById.get(payment.invoiceId)
                  : undefined;

                return (
                  <div key={payment.id} className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-600">
                          ✓
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {formatMoney(
                              Number(payment.amount),
                              payment.currency,
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {invoice?.invoiceNumber || "Payment"} ·{" "}
                            {payment.method || "Payment"}
                          </div>
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        {payment.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>{formatDate(payment.paidAt)}</span>
                      <span className="font-mono">
                        {shortReference(payment.internalReference)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {payments.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  No payments yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Reconciliation</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Automatic payment-to-invoice matching
                </p>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                {reconciliations.length} matched
              </span>
            </div>

            {reconciliations.map((reconciliation) => {
              const invoice = reconciliation.invoiceId
                ? invoiceById.get(reconciliation.invoiceId)
                : undefined;

              const payment = payments.find(
                (item) => item.id === reconciliation.paymentId,
              );

              return (
                <div
                  key={reconciliation.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-700">
                        ✓
                      </div>

                      <div>
                        <div className="font-semibold">
                          {invoice?.invoiceNumber || "Invoice"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {payment
                            ? formatMoney(
                                Number(payment.amount),
                                payment.currency,
                              )
                            : "Payment"}{" "}
                          · {reconciliation.matchType || "MATCHED"}
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-sm font-bold text-emerald-700">
                        100% confidence
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Exact match
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-white px-4 py-3 text-xs text-slate-500">
                    {reconciliation.reason ||
                      "Payment successfully matched to invoice."}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Payment link
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  Collect from anywhere
                </h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                ↗
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-300">
              Share a secure payment link with your customer and track the
              payment directly against the invoice.
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-slate-400">Invoice</div>
              <div className="mt-1 font-semibold">
                {invoices[0]?.invoiceNumber || "No invoice"}
              </div>

              <div className="mt-4 text-xs text-slate-400">Amount</div>
              <div className="mt-1 text-xl font-bold">
                {invoices[0]
                  ? formatMoney(
                      Number(invoices[0].totalAmount),
                      invoices[0].currency,
                    )
                  : "—"}
              </div>
            </div>

            <button className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400">
              Open payment link
            </button>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Demo payment flow · BorderPay MVP
            </p>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          BorderPay MVP · Cross-border invoicing, payments & reconciliation
        </footer>
      </div>
    </main>
  );
}
