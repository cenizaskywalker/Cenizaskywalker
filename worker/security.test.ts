import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./security";

describe("password hashing", () => {
  it("verifies the correct password and rejects another", async () => {
    const result = await hashPassword("Correct horse battery staple");
    await expect(verifyPassword("Correct horse battery staple", result.hash, result.salt, result.iterations)).resolves.toBe(true);
    await expect(verifyPassword("incorrect", result.hash, result.salt, result.iterations)).resolves.toBe(false);
  });

  it("uses a unique salt for each hash", async () => {
    const first = await hashPassword("Same password for test");
    const second = await hashPassword("Same password for test");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});
