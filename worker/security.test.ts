import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "./index";
import type { AppEnv } from "./types";

const testEnv = env as AppEnv;

describe("owner setup", () => {
  it("creates the first owner through the password hasher binding", async () => {
    const response = await app.request(
      "https://ceniza.test/api/admin/setup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Ceniza",
          email: "owner@example.com",
          password: "Correct horse battery staple",
        }),
      },
      testEnv,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Set-Cookie")).toContain(
      "HttpOnly; SameSite=Strict; Max-Age=604800; Secure",
    );
    await expect(response.json()).resolves.toMatchObject({
      csrfToken: expect.any(String),
    });

    const user = await testEnv.DB.prepare(
      "SELECT email,role,password_iterations FROM users",
    ).first<{
      email: string;
      role: string;
      password_iterations: number;
    }>();
    expect(user).toEqual({
      email: "owner@example.com",
      role: "OWNER",
      password_iterations: 100_000,
    });

    const loginResponse = await app.request(
      "https://ceniza.test/api/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "owner@example.com",
          password: "Correct horse battery staple",
        }),
      },
      testEnv,
    );
    expect(loginResponse.status).toBe(200);
  });
});

describe("password hashing", () => {
  it("verifies the correct password and rejects another", async () => {
    const hasher = testEnv.PASSWORD_HASHER.getByName("verification-test");
    const result = await hasher.hash("Correct horse battery staple");
    await expect(hasher.verify("Correct horse battery staple", result.hash, result.salt, result.iterations)).resolves.toBe(true);
    await expect(hasher.verify("incorrect", result.hash, result.salt, result.iterations)).resolves.toBe(false);
  });

  it("uses a unique salt for each hash", async () => {
    const hasher = testEnv.PASSWORD_HASHER.getByName("salt-test");
    const first = await hasher.hash("Same password for test");
    const second = await hasher.hash("Same password for test");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});
