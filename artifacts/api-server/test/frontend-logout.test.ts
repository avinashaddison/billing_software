import { afterEach, describe, expect, it, vi } from "vitest";
import { endServerSession, waitForServerLogout } from "../../toy-mall/src/lib/server-logout";

afterEach(() => vi.unstubAllGlobals());

describe("browser logout lifecycle", () => {
  it("waits for cookie-clearing logout before allowing the next login", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const logout = endServerSession();
    expect(endServerSession()).toBe(logout);
    let readyToLogin = false;
    const loginGate = waitForServerLogout().then(() => { readyToLogin = true; });
    await Promise.resolve();
    expect(readyToLogin).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST", credentials: "include", keepalive: true, signal: expect.any(AbortSignal),
    });
    finish(new Response('{"ok":true}', { status: 200 }));
    await logout;
    await loginGate;
    expect(readyToLogin).toBe(true);
  });

  it("reports failed logout instead of claiming success and allows retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(endServerSession()).rejects.toThrow("Server sign-out could not be confirmed");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(endServerSession()).resolves.toBeUndefined();
    await expect(waitForServerLogout()).resolves.toBeUndefined();
  });
});
