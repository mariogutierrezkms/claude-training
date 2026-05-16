import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();
vi.mock("@/actions", () => ({
  signIn: (...args: any[]) => mockSignInAction(...args),
  signUp: (...args: any[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: (...args: any[]) => mockGetAnonWorkData(...args),
  clearAnonWork: (...args: any[]) => mockClearAnonWork(...args),
}));

const mockGetProjects = vi.fn();
vi.mock("@/actions/get-projects", () => ({
  getProjects: (...args: any[]) => mockGetProjects(...args),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/create-project", () => ({
  createProject: (...args: any[]) => mockCreateProject(...args),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "default-project-id" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial state", () => {
    test("returns signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signIn — happy paths", () => {
    test("redirects to a newly-created project when there is no anon work and no existing projects", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({ id: "fresh-project-123" });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "password123");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("a@b.com", "password123");
      expect(returned).toEqual({ success: true });
      expect(mockCreateProject).toHaveBeenCalledTimes(1);
      const arg = mockCreateProject.mock.calls[0][0];
      expect(arg.messages).toEqual([]);
      expect(arg.data).toEqual({});
      expect(arg.name).toMatch(/^New Design #\d+$/);
      expect(mockPush).toHaveBeenCalledWith("/fresh-project-123");
      expect(mockClearAnonWork).not.toHaveBeenCalled();
    });

    test("creates a project from anon work and clears anon storage when anon messages exist", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      const anonMessages = [
        { id: "m1", role: "user", content: "make a button" },
      ];
      const anonFs = { "/App.jsx": { type: "file", content: "x" } };
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFs,
      });
      mockCreateProject.mockResolvedValue({ id: "from-anon-456" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledTimes(1);
      const arg = mockCreateProject.mock.calls[0][0];
      expect(arg.messages).toBe(anonMessages);
      expect(arg.data).toBe(anonFs);
      expect(arg.name).toMatch(/^Design from /);
      expect(mockClearAnonWork).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/from-anon-456");
      expect(mockGetProjects).not.toHaveBeenCalled();
    });

    test("redirects to the most recent existing project when no anon work", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "most-recent" },
        { id: "older" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/most-recent");
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockClearAnonWork).not.toHaveBeenCalled();
    });

    test("returns the action result so callers can read it", async () => {
      mockSignInAction.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "password123");
      });

      expect(returned).toEqual({ success: true });
    });
  });

  describe("signIn — failure paths", () => {
    test("does not run post-sign-in flow when the action reports failure", async () => {
      mockSignInAction.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "wrong");
      });

      expect(returned).toEqual({
        success: false,
        error: "Invalid credentials",
      });
      expect(mockGetAnonWorkData).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading to false even when the action throws", async () => {
      mockSignInAction.mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("a@b.com", "password123");
        })
      ).rejects.toThrow("boom");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp — happy paths", () => {
    test("runs the same post-sign-in flow on success", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("new@user.com", "password123");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith(
        "new@user.com",
        "password123"
      );
      expect(returned).toEqual({ success: true });
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });

    test("creates a project from anon work on successful sign-up", async () => {
      mockSignUpAction.mockResolvedValue({ success: true });
      const anonMessages = [{ id: "m1", role: "user", content: "hi" }];
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: { "/a.jsx": {} },
      });
      mockCreateProject.mockResolvedValue({ id: "signup-anon" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@user.com", "password123");
      });

      expect(mockClearAnonWork).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/signup-anon");
    });
  });

  describe("signUp — failure paths", () => {
    test("does not run post-sign-in flow when sign-up fails", async () => {
      mockSignUpAction.mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp("taken@user.com", "password123");
      });

      expect(returned).toEqual({
        success: false,
        error: "Email already registered",
      });
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading when sign-up throws", async () => {
      mockSignUpAction.mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@user.com", "password123");
        })
      ).rejects.toThrow("network down");

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("anon work with empty messages array falls through to projects lookup", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: [],
        fileSystemData: { "/leftover.jsx": {} },
      });
      mockGetProjects.mockResolvedValue([{ id: "existing" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password123");
      });

      expect(mockClearAnonWork).not.toHaveBeenCalled();
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    test("isLoading becomes true while the request is in flight and false after it resolves", async () => {
      let resolveAction: (value: any) => void = () => {};
      mockSignInAction.mockReturnValue(
        new Promise((resolve) => {
          resolveAction = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("a@b.com", "password123");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveAction({ success: false, error: "stop here" });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("picks the first project even when many exist", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        { id: "first" },
        { id: "second" },
        { id: "third" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/first");
    });
  });
});
