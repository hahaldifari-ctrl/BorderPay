"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PaymentLinkData = {
  paymentLink: {
    id: string;
    token: string;
    status: string;
    expiresAt?: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    description?: string | null;
    currency: string;
    totalAmount: string | number;
    amountPaid: string | number;
    status: string;
    dueDate?: string | null;
  };
  customer?: {
    id: string;
    name: string;
    email?: string | null;
    companyName?: string | null;
  } | null;
  business?: {
    id: string;
    name: string;
    email?: string | null;
    country?: string | null;
    defaultCurrency?: string | null;
  } | null;
};

type PaymentResult = {
  payment?: {
    internalReference?: string;
    amount?: string | number;
    currency?: string;
    status?: string;
  };
  invoice?: {
    amountPaid?: string | number;
    status?: string;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function PaymentPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<PaymentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<PaymentResult | null>(null);

  useEffect(() => {
    if (!token) return;

    const loadPaymentLink = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/payment-links/${encodeURIComponent(token)}`,
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.message ?? "Payment link could not be loaded.",
          );
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Payment link could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadPaymentLink();
  }, [token]);

  const handlePayment = async () => {
    if (!data) return;

    try {
      setPaying(true);
      setError("");
      setSuccess(null);

      const response = await fetch(`${API_URL}/payments/simulate-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          method: "CARD",
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Payment could not be completed.");
      }

      const result = await response.json();
      setSuccess(result);

      setData((current) =>
        current
          ? {
              ...current,
              invoice: {
                ...current.invoice,
                amountPaid:
                  result.invoice?.amountPaid ??
                  current.invoice.amountPaid,
                status:
                  result.invoice?.status ??
                  current.invoice.status,
              },
            }
          : current,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Payment could not be completed.",
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-gray-600">Loading payment...</p>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">BorderPay</h1>

          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">
              Payment link unavailable
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { invoice, customer, business } = data;
  const total = Number(invoice.totalAmount);
  const paid = Number(invoice.amountPaid);
  const remaining = Math.max(total - paid, 0);
  const isPaid = invoice.status === "PAID" || remaining <= 0;

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">BorderPay</p>
              <h1 className="mt-1 text-2xl font-bold">
                {business?.name ?? "Payment"}
              </h1>
            </div>

            <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              {isPaid ? "Paid" : "Secure payment"}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-gray-500">Amount due</p>

            <p className="mt-1 text-4xl font-bold tracking-tight">
              {invoice.currency} {remaining.toLocaleString()}
            </p>
          </div>

          <div className="mt-8 space-y-4 rounded-xl bg-gray-50 p-5">
            <div className="flex justify-between gap-4">
              <span className="text-sm text-gray-500">Invoice</span>
              <span className="text-sm font-medium">
                {invoice.invoiceNumber}
              </span>
            </div>

            {invoice.description && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-gray-500">Description</span>
                <span className="text-right text-sm font-medium">
                  {invoice.description}
                </span>
              </div>
            )}

            {customer?.name && (
              <div className="flex justify-between gap-4">
                <span className="text-sm text-gray-500">Customer</span>
                <span className="text-right text-sm font-medium">
                  {customer.name}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success ? (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
              <p className="font-semibold text-green-800">
                Payment successful
              </p>

              <p className="mt-2 text-sm text-green-700">
                Reference:{" "}
                <span className="font-mono">
                  {success.payment?.internalReference ?? "N/A"}
                </span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePayment}
              disabled={paying || isPaid}
              className="mt-6 w-full rounded-xl bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPaid
                ? "Invoice Paid"
                : paying
                  ? "Processing payment..."
                  : `Pay ${invoice.currency} ${remaining.toLocaleString()}`}
            </button>
          )}

          <p className="mt-5 text-center text-xs text-gray-400">
            Payment powered by BorderPay
          </p>
        </div>
      </div>
    </main>
  );
}
