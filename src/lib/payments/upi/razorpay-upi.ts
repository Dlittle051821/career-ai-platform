import "server-only";
import Razorpay from "razorpay";
import { classifyRazorpayError } from "../providers/razorpay";
import type { ObservedPayment } from "./attest";

/**
 * NW-PAYMENT-V1 — the Razorpay calls UPI checkout needs, on the official SDK
 * (razorpay-node). Request shapes follow Razorpay's QR Codes API and Orders
 * API documentation:
 *   POST /v1/payments/qr_codes              type=upi_qr, usage=single_use, fixed_amount=true, payment_amount (paise), close_by (unix s)
 *   POST /v1/payments/qr_codes/{id}/close
 *   GET  /v1/payments/qr_codes/{id}/payments
 *   POST /v1/orders                         amount (paise), currency, receipt, notes
 *   GET  /v1/orders/{id}/payments
 *   POST /v1/payments/{id}/capture          only for an authorised payment of exactly the order amount
 * `apiBaseUrl` differs from https://api.razorpay.com only for the local test
 * double (see config.ts for when that is allowed).
 */

export interface CreatedQr {
  id: string;
  imageUrl: string;
  closeBy: number;
  amount: number;
  currency: string;
  fixedAmount: boolean;
  usage: string;
}

export interface CreatedOrder {
  id: string;
  amount: number;
  currency: string;
}

type RawPayment = { id: string; amount: number | string; currency: string; status: string; captured?: boolean; method?: string | null; error_description?: string | null };

function toObserved(p: RawPayment): ObservedPayment {
  return {
    id: String(p.id),
    amount: Number(p.amount),
    currency: String(p.currency),
    status: String(p.status),
    captured: Boolean(p.captured),
    method: p.method ?? null,
    error_description: p.error_description ?? null,
  };
}

export class RazorpayUpiClient {
  private readonly client: Razorpay;

  constructor(config: { keyId: string; keySecret: string; apiBaseUrl: string }) {
    this.client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    if (config.apiBaseUrl !== "https://api.razorpay.com") {
      // razorpay-node fixes its host in the constructor; the axios instance it
      // keeps on `api.rq` is the only way to aim it at the local test double.
      const api = (this.client as unknown as { api: { rq: { defaults: { baseURL: string } } } }).api;
      api.rq.defaults.baseURL = config.apiBaseUrl;
    }
  }

  async createUpiQr(input: { amountMinorUnits: number; currency: string; closeBy: number; attemptId: string; invoiceId: string; description: string }): Promise<CreatedQr> {
    try {
      const qr = (await this.client.qrCode.create({
        type: "upi_qr",
        name: "Nextwise",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: input.amountMinorUnits,
        description: input.description.slice(0, 100),
        close_by: input.closeBy,
        notes: { nw_attempt_id: input.attemptId, nw_invoice_id: input.invoiceId },
      } as never)) as unknown as { id: string; image_url: string; close_by: number; payment_amount: number; usage: string; fixed_amount: boolean };
      return { id: qr.id, imageUrl: qr.image_url, closeBy: Number(qr.close_by), amount: Number(qr.payment_amount), currency: input.currency, fixedAmount: Boolean(qr.fixed_amount), usage: qr.usage };
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  async closeQr(qrId: string): Promise<void> {
    try {
      await this.client.qrCode.close(qrId);
    } catch (err) {
      // already closed / paid: nothing to do. Any payment that reached it is still found by reconciliation.
      const classified = classifyRazorpayError(err);
      if (classified.name !== "GatewayDefiniteRejectionError") throw classified;
    }
  }

  async fetchQrPayments(qrId: string): Promise<ObservedPayment[]> {
    try {
      const res = (await this.client.qrCode.fetchAllPayments(qrId, { count: 25 } as never)) as unknown as { items?: RawPayment[] };
      return (res.items ?? []).map(toObserved);
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  async createOrder(input: { amountMinorUnits: number; currency: string; receipt: string; attemptId: string; invoiceId: string }): Promise<CreatedOrder> {
    try {
      const order = await this.client.orders.create({
        amount: input.amountMinorUnits,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        notes: { nw_attempt_id: input.attemptId, nw_invoice_id: input.invoiceId },
        payment_capture: true,
      } as never);
      return { id: String(order.id), amount: Number(order.amount), currency: String(order.currency) };
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  async fetchOrderPayments(orderId: string): Promise<ObservedPayment[]> {
    try {
      const res = (await this.client.orders.fetchPayments(orderId)) as unknown as { items?: RawPayment[] };
      return (res.items ?? []).map(toObserved);
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }

  async capture(paymentId: string, amountMinorUnits: number, currency: string): Promise<ObservedPayment> {
    try {
      return toObserved((await this.client.payments.capture(paymentId, amountMinorUnits, currency)) as unknown as RawPayment);
    } catch (err) {
      throw classifyRazorpayError(err);
    }
  }
}
