import { handleStripeWebhook } from "@/services/stripe-webhook";

// Stripe calls this after a Checkout payment. The body is read as raw text
// because the signature is checked against exactly those bytes.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const { status, message } = await handleStripeWebhook(rawBody, request.headers.get("stripe-signature"));
  return Response.json({ message }, { status });
}
