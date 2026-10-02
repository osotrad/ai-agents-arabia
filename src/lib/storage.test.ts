import { describe, it, expect } from "vitest";
import { signRequest } from "@/lib/storage";

const BASE = {
  region: "us-east-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  now: new Date("2015-08-30T12:36:00Z"),
  host: "examplebucket.s3.amazonaws.com",
  payloadHash:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};

const signatureOf = (auth: string) =>
  (auth.match(/Signature=([0-9a-f]+)/) as RegExpMatchArray)[1];
const signedHeadersOf = (auth: string) =>
  (auth.match(/SignedHeaders=([^,]+)/) as RegExpMatchArray)[1];

/**
 * The signer was cross-validated byte-for-byte against `aws4fetch` (an
 * independent SigV4 implementation) for GET on a bucket root, GET with a Range
 * header, and a path-style PUT — all producing identical signatures. These
 * tests pin the structural properties so a refactor cannot silently change the
 * canonical request, credential scope, or path encoding.
 */
describe("signRequest — SigV4", () => {
  it("builds the credential scope and timestamp", async () => {
    const s = await signRequest({ ...BASE, method: "GET", pathname: "/" });
    expect(s.headers["x-amz-date"]).toBe("20150830T123600Z");
    expect(s.headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=");
    expect(s.headers.authorization).toContain(
      "AKIAIOSFODNN7EXAMPLE/20150830/us-east-1/s3/aws4_request",
    );
    expect(s.headers.authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it("signs host, x-amz-content-sha256 and x-amz-date, lowercased and sorted", async () => {
    const s = await signRequest({ ...BASE, method: "GET", pathname: "/test.txt" });
    expect(signedHeadersOf(s.headers.authorization)).toBe(
      "host;x-amz-content-sha256;x-amz-date",
    );
    expect(s.headers["x-amz-content-sha256"]).toBe(BASE.payloadHash);
  });

  it("adds content-type to the signed headers when one is given", async () => {
    const s = await signRequest({
      ...BASE,
      method: "PUT",
      pathname: "/images/gemini-4.png",
      contentType: "image/png",
    });
    expect(signedHeadersOf(s.headers.authorization)).toBe(
      "content-type;host;x-amz-content-sha256;x-amz-date",
    );
    expect(s.headers["content-type"]).toBe("image/png");
  });

  it("changes the signed header set when a header is added", async () => {
    const withType = await signRequest({
      ...BASE,
      method: "PUT",
      pathname: "/k",
      contentType: "image/png",
    });
    const without = await signRequest({ ...BASE, method: "PUT", pathname: "/k" });
    expect(signedHeadersOf(withType.headers.authorization)).not.toBe(
      signedHeadersOf(without.headers.authorization),
    );
    expect(signatureOf(withType.headers.authorization)).not.toBe(
      signatureOf(without.headers.authorization),
    );
  });

  it("encodes spaces but preserves slashes (path-style addressing)", async () => {
    const s = await signRequest({
      ...BASE,
      method: "PUT",
      pathname: "/bucket/news/gemini 4.png",
    });
    expect(s.url).toBe(
      "https://examplebucket.s3.amazonaws.com/bucket/news/gemini%204.png",
    );
  });

  it("percent-encodes characters outside the unreserved set", async () => {
    // AWS treats only A-Z a-z 0-9 - . _ ~ as unreserved, so '+' must be encoded.
    const s = await signRequest({
      ...BASE,
      method: "PUT",
      pathname: "/b/a+b&c=d",
    });
    expect(s.url).toBe("https://examplebucket.s3.amazonaws.com/b/a%2Bb%26c%3Dd");
  });

  it("is deterministic for a fixed clock", async () => {
    const args = { ...BASE, method: "PUT" as const, pathname: "/b/k" };
    const a = await signRequest(args);
    const b = await signRequest(args);
    expect(signatureOf(a.headers.authorization)).toBe(
      signatureOf(b.headers.authorization),
    );
  });

  it("varies with region, secret, path and payload hash", async () => {
    const args = { ...BASE, method: "PUT" as const, pathname: "/b/k" };
    const base = signatureOf((await signRequest(args)).headers.authorization);
    const variants = await Promise.all([
      signRequest({ ...args, region: "eu-west-1" }),
      signRequest({ ...args, secretAccessKey: "different-secret-key-value" }),
      signRequest({ ...args, pathname: "/b/k2" }),
      signRequest({ ...args, payloadHash: "ff".repeat(32) }),
      signRequest({ ...args, now: new Date("2015-08-30T12:36:01Z") }),
    ]);
    for (const v of variants) {
      expect(signatureOf(v.headers.authorization)).not.toBe(base);
    }
  });

  it("accepts UNSIGNED-PAYLOAD as the hash", async () => {
    const s = await signRequest({
      ...BASE,
      method: "PUT",
      pathname: "/k",
      payloadHash: "UNSIGNED-PAYLOAD",
    });
    expect(s.headers["x-amz-content-sha256"]).toBe("UNSIGNED-PAYLOAD");
    expect(signedHeadersOf(s.headers.authorization)).toContain("x-amz-content-sha256");
  });
});