import { beforeEach, describe, expect, it, vi } from "vitest";

// Vercel Blob is the system boundary; replace it with a fake store.
const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put }));

const { uploadLogoFromRequest } = await import("./upload-logo");

const SHOP_ID = "shop-123";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

function request(file: File | null, headers: Record<string, string> = {}): Request {
  const body = new FormData();
  if (file) body.set("logo", file);
  return new Request("http://localhost/api/uploads/logo", { method: "POST", body, headers });
}

beforeEach(() => {
  put.mockReset();
  put.mockImplementation(async (pathname: string) => ({ url: `https://blob.example.com/${pathname}` }));
});

describe("uploadLogoFromRequest", () => {
  it("stores the logo and returns its URL", async () => {
    const result = await uploadLogoFromRequest(SHOP_ID, request(new File([PNG], "logo.png")));

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ url: expect.stringMatching(/\/images\/shop-123\/.+\.png$/) });
  });

  it("sanitises an SVG logo before storing it", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>';
    await uploadLogoFromRequest(SHOP_ID, request(new File([svg], "logo.svg")));

    expect(String(put.mock.calls[0][1])).toBe('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
  });

  it("refuses a body declared larger than 2 MB without reading it", async () => {
    const req = request(new File([PNG], "logo.png"), { "content-length": String(3 * 1024 * 1024) });
    const formData = vi.spyOn(req, "formData");

    const result = await uploadLogoFromRequest(SHOP_ID, req);
    expect(result).toEqual({ status: 413, body: { error: "Choose a logo under 2 MB." } });
    expect(formData).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses a file over 2 MB", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    const result = await uploadLogoFromRequest(SHOP_ID, request(new File([big], "big.png")));

    expect(result).toEqual({ status: 413, body: { error: "Choose a logo under 2 MB." } });
    expect(put).not.toHaveBeenCalled();
  });

  it("refuses a file that is not an image, and a request with no file", async () => {
    expect(await uploadLogoFromRequest(SHOP_ID, request(new File(["%PDF-1.7"], "x.pdf")))).toEqual({
      status: 415,
      body: { error: "Choose a PNG, JPEG, GIF, WebP or SVG logo." },
    });
    expect(await uploadLogoFromRequest(SHOP_ID, request(null))).toEqual({
      status: 400,
      body: { error: "Choose a logo to upload." },
    });
  });
});
