import { describe, expect, it } from "vitest";
import { buildSessionParams } from "./stripe";

describe("buildSessionParams", () => {
  const params = buildSessionParams({
    currency: "eur",
    lines: [{ name: "Pixel", unitAmount: 19900, quantity: 2 }],
    metadata: { app: "sellify-stores" },
    clientReferenceId: "shop-1",
    successUrl: "https://a.test/ok",
    cancelUrl: "https://a.test/no",
  });

  it("allows card only, so payment is confirmed before the completed event", () => {
    expect(params.allowed_payment_method_types).toEqual(["card"]);
    expect(params.mode).toBe("payment");
  });

  it("carries server-side amounts, metadata and return urls", () => {
    expect(params.line_items).toEqual([
      { quantity: 2, price_data: { currency: "eur", unit_amount: 19900, product_data: { name: "Pixel" } } },
    ]);
    expect(params.client_reference_id).toBe("shop-1");
    expect(params.success_url).toBe("https://a.test/ok");
  });
});
