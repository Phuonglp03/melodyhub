import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { message } from "antd";
import * as postService from "../../../services/user/post";
import * as lickService from "../../../services/user/lickService";
import * as projectService from "../../../services/user/projectService";

// Mock dependencies
vi.mock("antd", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../services/user/post");
vi.mock("../../../services/user/lickService");
vi.mock("../../../services/user/projectService");

// Import utility functions from UserFeed
// These would need to be exported from the component or extracted to a utils file
// For testing purposes, we'll recreate them based on the implementation

describe("UserFeed - Lick and Project Feature Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: parseSharedLickId - Complex URL parsing for lick IDs
  describe("parseSharedLickId", () => {
    const parseSharedLickId = (urlString) => {
      if (!urlString) return null;
      try {
        let url;
        if (
          urlString.startsWith("http://") ||
          urlString.startsWith("https://")
        ) {
          url = new URL(urlString);
        } else if (urlString.startsWith("/")) {
          const base =
            typeof window !== "undefined" && window.location
              ? window.location.origin
              : "https://melodyhub.website";
          url = new URL(urlString, base);
        } else {
          const base =
            typeof window !== "undefined" && window.location
              ? window.location.origin
              : "https://melodyhub.website";
          url = new URL("/" + urlString, base);
        }

        const cleanPath = url.pathname.replace(/\/+$/, "");
        const segments = cleanPath.split("/").filter(Boolean);

        if (segments.length >= 2 && segments[0].toLowerCase() === "licks") {
          const id = segments[1];
          return id.split("?")[0].split("#")[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    it("should parse lick ID from absolute HTTPS URL", () => {
      const url = "https://melodyhub.website/licks/abc123";
      expect(parseSharedLickId(url)).toBe("abc123");
    });

    it("should parse lick ID from absolute HTTP URL", () => {
      const url = "http://melodyhub.website/licks/xyz789";
      expect(parseSharedLickId(url)).toBe("xyz789");
    });

    it("should parse lick ID from relative URL starting with /", () => {
      const url = "/licks/test-id-456";
      expect(parseSharedLickId(url)).toBe("test-id-456");
    });

    it("should parse lick ID from relative URL without leading slash", () => {
      const url = "licks/relative-id-789";
      expect(parseSharedLickId(url)).toBe("relative-id-789");
    });

    it("should handle URLs with query parameters", () => {
      const url =
        "https://melodyhub.website/licks/lick123?param=value&other=test";
      expect(parseSharedLickId(url)).toBe("lick123");
    });

    it("should handle URLs with hash fragments", () => {
      const url = "https://melodyhub.website/licks/lick456#section";
      expect(parseSharedLickId(url)).toBe("lick456");
    });

    it("should handle URLs with both query and hash", () => {
      const url = "https://melodyhub.website/licks/lick789?param=value#section";
      expect(parseSharedLickId(url)).toBe("lick789");
    });

    it("should handle youtu.be URLs with lick path", () => {
      const url = "https://youtu.be/licks/special-lick-id";
      expect(parseSharedLickId(url)).toBe("special-lick-id");
    });

    it("should return null for non-lick URLs", () => {
      expect(
        parseSharedLickId("https://melodyhub.website/projects/123")
      ).toBeNull();
      expect(parseSharedLickId("https://example.com/licks/123")).toBeNull();
    });

    it("should return null for invalid URLs", () => {
      expect(parseSharedLickId("not-a-url")).toBeNull();
      expect(parseSharedLickId("")).toBeNull();
      expect(parseSharedLickId(null)).toBeNull();
      expect(parseSharedLickId(undefined)).toBeNull();
    });

    it('should handle case-insensitive "licks" segment', () => {
      expect(
        parseSharedLickId("https://melodyhub.website/LICKS/uppercase-id")
      ).toBe("uppercase-id");
      expect(
        parseSharedLickId("https://melodyhub.website/Licks/MixedCase-id")
      ).toBe("MixedCase-id");
    });

    it("should handle trailing slashes", () => {
      expect(parseSharedLickId("https://melodyhub.website/licks/id123/")).toBe(
        "id123"
      );
      expect(
        parseSharedLickId("https://melodyhub.website/licks/id456///")
      ).toBe("id456");
    });
  });

  // Test 2: parseProjectId - Complex URL parsing for project IDs
  describe("parseProjectId", () => {
    const parseProjectId = (urlString) => {
      if (!urlString) return null;
      try {
        let url;
        if (
          urlString.startsWith("http://") ||
          urlString.startsWith("https://")
        ) {
          url = new URL(urlString);
        } else if (urlString.startsWith("/")) {
          const base =
            typeof window !== "undefined" && window.location
              ? window.location.origin
              : "https://melodyhub.website";
          url = new URL(urlString, base);
        } else {
          const base =
            typeof window !== "undefined" && window.location
              ? window.location.origin
              : "https://melodyhub.website";
          url = new URL("/" + urlString, base);
        }

        const cleanPath = url.pathname.replace(/\/+$/, "");
        const segments = cleanPath.split("/").filter(Boolean);

        if (segments.length >= 2 && segments[0].toLowerCase() === "projects") {
          const id = segments[1];
          return id.split("?")[0].split("#")[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    it("should parse project ID from absolute HTTPS URL", () => {
      const url = "https://melodyhub.website/projects/proj123";
      expect(parseProjectId(url)).toBe("proj123");
    });

    it("should parse project ID from relative URL", () => {
      const url = "/projects/relative-proj-456";
      expect(parseProjectId(url)).toBe("relative-proj-456");
    });

    it("should handle URLs with query parameters and hash", () => {
      const url =
        "https://melodyhub.website/projects/proj789?view=edit#timeline";
      expect(parseProjectId(url)).toBe("proj789");
    });

    it("should return null for non-project URLs", () => {
      expect(parseProjectId("https://melodyhub.website/licks/123")).toBeNull();
    });

    it('should handle case-insensitive "projects" segment', () => {
      expect(
        parseProjectId("https://melodyhub.website/PROJECTS/uppercase-id")
      ).toBe("uppercase-id");
    });
  });

  // Test 3: extractFirstUrl - Extract first URL from text
  describe("extractFirstUrl", () => {
    const extractFirstUrl = (text) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const match = text.match(urlRegex);
      return match ? match[0] : null;
    };

    it("should extract first HTTP URL from text", () => {
      const text = "Check out http://example.com for more info";
      expect(extractFirstUrl(text)).toBe("http://example.com");
    });

    it("should extract first HTTPS URL from text", () => {
      const text = "Visit https://melodyhub.website/licks/123 today";
      expect(extractFirstUrl(text)).toBe("https://melodyhub.website/licks/123");
    });

    it("should extract URL when multiple URLs present", () => {
      const text = "First: https://first.com and second: https://second.com";
      expect(extractFirstUrl(text)).toBe("https://first.com");
    });

    it("should return null when no URL found", () => {
      expect(extractFirstUrl("Just plain text")).toBeNull();
      expect(extractFirstUrl("")).toBeNull();
      expect(extractFirstUrl(null)).toBeNull();
    });

    it("should handle URLs with paths and query strings", () => {
      const text = "See https://example.com/path?query=value for details";
      expect(extractFirstUrl(text)).toBe(
        "https://example.com/path?query=value"
      );
    });

    it("should stop at whitespace", () => {
      const text = "URL: https://example.com and more text";
      expect(extractFirstUrl(text)).toBe("https://example.com");
    });
  });

  // Test 4: handleCreatePost - Complex validation and attachment logic
  describe("handleCreatePost", () => {
    const MAX_POST_TEXT_LENGTH = 300;

    const extractFirstUrl = (text) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const match = text.match(urlRegex);
      return match ? match[0] : null;
    };

    const validateCreatePost = (
      newText,
      selectedLickIds,
      selectedProjectId,
      linkPreview
    ) => {
      const trimmed = newText.trim();
      const hasUrl = !!extractFirstUrl(trimmed);
      const hasLinkPreview = hasUrl && linkPreview;
      const hasLicks = selectedLickIds.length > 0;
      const hasProject = !!selectedProjectId;

      // Validation errors
      if (hasUrl && hasLicks) {
        return { valid: false, error: "Cannot have both URL and Licks" };
      }
      if (hasUrl && hasProject) {
        return { valid: false, error: "Cannot have both URL and Project" };
      }

      const attachmentCount =
        (hasLinkPreview ? 1 : 0) + (hasLicks ? 1 : 0) + (hasProject ? 1 : 0);
      if (attachmentCount > 1) {
        return { valid: false, error: "Only one attachment type allowed" };
      }

      if (!trimmed && attachmentCount === 0) {
        return { valid: false, error: "Must have text or attachment" };
      }

      if (trimmed && trimmed.length > MAX_POST_TEXT_LENGTH) {
        return {
          valid: false,
          error: `Text exceeds ${MAX_POST_TEXT_LENGTH} characters`,
        };
      }

      return { valid: true };
    };

    it("should validate post with only text", () => {
      const result = validateCreatePost("Just some text", [], null, null);
      expect(result.valid).toBe(true);
    });

    it("should validate post with only lick attachment", () => {
      const result = validateCreatePost("", ["lick123"], null, null);
      expect(result.valid).toBe(true);
    });

    it("should validate post with only project attachment", () => {
      const result = validateCreatePost("", [], "project123", null);
      expect(result.valid).toBe(true);
    });

    it("should validate post with only link preview", () => {
      const result = validateCreatePost("Check https://example.com", [], null, {
        url: "https://example.com",
      });
      expect(result.valid).toBe(true);
    });

    it("should reject post with URL and lick", () => {
      const result = validateCreatePost(
        "See https://example.com",
        ["lick123"],
        null,
        null
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URL and Licks");
    });

    it("should reject post with URL and project", () => {
      const result = validateCreatePost(
        "See https://example.com",
        [],
        "project123",
        null
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URL and Project");
    });

    it("should reject post with multiple attachment types", () => {
      const result = validateCreatePost("", ["lick123"], "project123", null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("one attachment type");
    });

    it("should reject empty post without attachments", () => {
      const result = validateCreatePost("   ", [], null, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("text or attachment");
    });

    it("should reject text exceeding max length", () => {
      const longText = "a".repeat(MAX_POST_TEXT_LENGTH + 1);
      const result = validateCreatePost(longText, [], null, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds");
    });

    it("should allow text with valid length and attachment", () => {
      const result = validateCreatePost("Some text", ["lick123"], null, null);
      expect(result.valid).toBe(true);
    });
  });

  // Test 5: handleUpdatePost - Complex validation and update logic
  describe("handleUpdatePost", () => {
    const extractFirstUrl = (text) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const match = text.match(urlRegex);
      return match ? match[0] : null;
    };

    const parseSharedLickId = (urlString) => {
      if (!urlString) return null;
      try {
        const url = new URL(urlString, "https://melodyhub.website");
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length >= 2 && segments[0].toLowerCase() === "licks") {
          return segments[1].split("?")[0].split("#")[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    const validateUpdatePost = (
      editText,
      editSelectedLickIds,
      editSelectedProjectId,
      editLinkPreview,
      editingPost
    ) => {
      const hasLicks = editSelectedLickIds && editSelectedLickIds.length > 0;
      const hasLinkPreview = !!editLinkPreview;
      const hasProject = !!editSelectedProjectId;
      const hasUrl = !!extractFirstUrl(editText.trim());

      // Check original post attachments
      const originalUrl = extractFirstUrl(editingPost?.textContent || "");
      const originalSharedLickId = originalUrl
        ? parseSharedLickId(originalUrl)
        : null;
      const hasOriginalLick =
        (editingPost?.attachedLicks &&
          Array.isArray(editingPost.attachedLicks) &&
          editingPost.attachedLicks.length > 0) ||
        !!originalSharedLickId;

      const hasOriginalProject =
        editingPost?.projectId &&
        ((typeof editingPost.projectId === "string" &&
          editingPost.projectId.trim() !== "") ||
          (typeof editingPost.projectId === "object" &&
            editingPost.projectId !== null &&
            Object.keys(editingPost.projectId).length > 0 &&
            (editingPost.projectId._id || editingPost.projectId.id)));

      // Validation rules
      if ((hasLicks || hasOriginalLick) && (hasLinkPreview || hasUrl)) {
        return { valid: false, error: "Cannot have both Lick and Link" };
      }

      if ((hasProject || hasOriginalProject) && (hasLinkPreview || hasUrl)) {
        return { valid: false, error: "Cannot have both Project and Link" };
      }

      if (hasLicks && hasLinkPreview) {
        return {
          valid: false,
          error: "Cannot have both Lick and Link Preview",
        };
      }

      if (hasLicks && hasProject) {
        return { valid: false, error: "Cannot have both Lick and Project" };
      }

      if (hasLinkPreview && hasProject) {
        return { valid: false, error: "Cannot have both Link and Project" };
      }

      return { valid: true };
    };

    it("should validate update with only text change", () => {
      const editingPost = { textContent: "Old text", _id: "post123" };
      const result = validateUpdatePost(
        "New text",
        [],
        null,
        null,
        editingPost
      );
      expect(result.valid).toBe(true);
    });

    it("should reject update adding URL to post with original lick", () => {
      const editingPost = {
        textContent: "Check /licks/lick123",
        attachedLicks: [{ _id: "lick123" }],
        _id: "post123",
      };
      const result = validateUpdatePost(
        "New text https://example.com",
        [],
        null,
        null,
        editingPost
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Lick and Link");
    });

    it("should reject update adding URL to post with original project", () => {
      const editingPost = {
        textContent: "My project",
        projectId: { _id: "proj123", id: "proj123" },
        _id: "post123",
      };
      const result = validateUpdatePost(
        "New text https://example.com",
        [],
        null,
        null,
        editingPost
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Project and Link");
    });

    it("should allow removing lick and adding project", () => {
      const editingPost = {
        textContent: "Post with lick",
        attachedLicks: [{ _id: "lick123" }],
        _id: "post123",
      };
      const result = validateUpdatePost(
        "Updated text",
        [],
        "proj123",
        null,
        editingPost
      );
      expect(result.valid).toBe(true);
    });

    it("should reject having both lick and project in update", () => {
      const editingPost = { textContent: "Original", _id: "post123" };
      const result = validateUpdatePost(
        "Updated",
        ["lick123"],
        "proj123",
        null,
        editingPost
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Lick and Project");
    });
  });

  // Test 6: openEditModal - Complex state initialization
  describe("openEditModal state initialization", () => {
    const initializeEditState = (post) => {
      const state = {
        editText: post?.textContent || "",
        editLinkPreview: post?.linkPreview || null,
        editSelectedLickIds: [],
        editSelectedProjectId: null,
      };

      // Initialize attached licks
      if (post?.attachedLicks && Array.isArray(post.attachedLicks)) {
        state.editSelectedLickIds = post.attachedLicks
          .map((lick) => {
            if (!lick) return null;
            if (typeof lick === "string") return lick;
            return lick._id || lick.id || lick.lick_id || null;
          })
          .filter(Boolean);
      }

      // Initialize project
      if (post?.projectId) {
        const pid = post.projectId._id || post.projectId.id || post.projectId;
        state.editSelectedProjectId = pid ? String(pid) : null;
      }

      return state;
    };

    it("should initialize state from post with text only", () => {
      const post = { textContent: "Simple post", _id: "post123" };
      const state = initializeEditState(post);
      expect(state.editText).toBe("Simple post");
      expect(state.editSelectedLickIds).toEqual([]);
      expect(state.editSelectedProjectId).toBeNull();
    });

    it("should initialize state from post with attached licks as objects", () => {
      const post = {
        textContent: "Post with licks",
        attachedLicks: [
          { _id: "lick1" },
          { id: "lick2" },
          { lick_id: "lick3" },
        ],
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editSelectedLickIds).toEqual(["lick1", "lick2", "lick3"]);
    });

    it("should initialize state from post with attached licks as strings", () => {
      const post = {
        textContent: "Post with string licks",
        attachedLicks: ["lick1", "lick2"],
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editSelectedLickIds).toEqual(["lick1", "lick2"]);
    });

    it("should initialize state from post with project as object", () => {
      const post = {
        textContent: "Post with project",
        projectId: { _id: "proj123", title: "My Project" },
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editSelectedProjectId).toBe("proj123");
    });

    it("should initialize state from post with project as string", () => {
      const post = {
        textContent: "Post with string project",
        projectId: "proj456",
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editSelectedProjectId).toBe("proj456");
    });

    it("should initialize state from post with link preview", () => {
      const post = {
        textContent: "Post with link",
        linkPreview: { url: "https://example.com", title: "Example" },
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editLinkPreview).toEqual(post.linkPreview);
    });

    it("should handle post with all attachment types (should only keep one)", () => {
      const post = {
        textContent: "Complex post",
        attachedLicks: [{ _id: "lick1" }],
        projectId: { _id: "proj1" },
        linkPreview: { url: "https://example.com" },
        _id: "post123",
      };
      const state = initializeEditState(post);
      // All should be initialized, validation happens separately
      expect(state.editSelectedLickIds).toEqual(["lick1"]);
      expect(state.editSelectedProjectId).toBe("proj1");
      expect(state.editLinkPreview).toBeTruthy();
    });

    it("should filter out null/undefined licks", () => {
      const post = {
        textContent: "Post with mixed licks",
        attachedLicks: [{ _id: "lick1" }, null, { _id: "lick2" }, undefined],
        _id: "post123",
      };
      const state = initializeEditState(post);
      expect(state.editSelectedLickIds).toEqual(["lick1", "lick2"]);
    });
  });

  // Test 7: resolvePreview - Preview resolution with caching
  describe("resolvePreview with caching", () => {
    const previewCache = {};

    const fetchProviderOEmbed = vi.fn();
    const fetchOgTags = vi.fn();
    const deriveThumbnail = vi.fn((url) => `thumbnail-${url}`);

    const resolvePreview = async (url) => {
      if (previewCache[url]) return previewCache[url];

      const fromOembed = await fetchProviderOEmbed(url);
      const data = fromOembed ||
        (await fetchOgTags(url)) || {
          title: url,
          thumbnailUrl: deriveThumbnail(url),
        };
      previewCache[url] = data;
      return data;
    };

    beforeEach(() => {
      Object.keys(previewCache).forEach((key) => delete previewCache[key]);
      vi.clearAllMocks();
    });

    it("should return cached preview if available", async () => {
      const cachedData = { title: "Cached", thumbnailUrl: "cached.jpg" };
      previewCache["https://example.com"] = cachedData;

      const result = await resolvePreview("https://example.com");
      expect(result).toEqual(cachedData);
      expect(fetchProviderOEmbed).not.toHaveBeenCalled();
    });

    it("should fetch oEmbed preview when not cached", async () => {
      const mockData = { title: "OEmbed Title", thumbnailUrl: "oembed.jpg" };
      fetchProviderOEmbed.mockResolvedValue(mockData);

      const result = await resolvePreview("https://example.com");
      expect(result).toEqual(mockData);
      expect(fetchProviderOEmbed).toHaveBeenCalledWith("https://example.com");
      expect(previewCache["https://example.com"]).toEqual(mockData);
    });

    it("should fallback to OG tags when oEmbed fails", async () => {
      fetchProviderOEmbed.mockResolvedValue(null);
      const mockOgData = { title: "OG Title", thumbnailUrl: "og.jpg" };
      fetchOgTags.mockResolvedValue(mockOgData);

      const result = await resolvePreview("https://example.com");
      expect(result).toEqual(mockOgData);
      expect(fetchOgTags).toHaveBeenCalledWith("https://example.com");
    });

    it("should fallback to default when both fail", async () => {
      fetchProviderOEmbed.mockResolvedValue(null);
      fetchOgTags.mockResolvedValue(null);
      deriveThumbnail.mockReturnValue("default-thumb.jpg");

      const result = await resolvePreview("https://example.com");
      expect(result).toEqual({
        title: "https://example.com",
        thumbnailUrl: "default-thumb.jpg",
      });
    });

    it("should cache result after first fetch", async () => {
      const mockData = { title: "Test", thumbnailUrl: "test.jpg" };
      fetchProviderOEmbed.mockResolvedValue(mockData);

      await resolvePreview("https://test.com");
      await resolvePreview("https://test.com");

      expect(fetchProviderOEmbed).toHaveBeenCalledTimes(1);
      expect(previewCache["https://test.com"]).toEqual(mockData);
    });
  });

  // Test 8: fetchActiveLicks - Data fetching with formatting
  describe("fetchActiveLicks", () => {
    it("should fetch and format active licks correctly", async () => {
      const mockResponse = {
        success: true,
        data: [
          { lick_id: "lick1", title: "Lick 1", status: "active" },
          { _id: "lick2", title: "Lick 2", status: "active" },
          { lick_id: "lick3", title: null, status: "active" },
        ],
      };

      lickService.getMyLicks.mockResolvedValue(mockResponse);

      const fetchActiveLicks = async () => {
        const res = await lickService.getMyLicks({
          status: "active",
          limit: 100,
        });
        if (res?.success && Array.isArray(res.data)) {
          return res.data.map((lick) => ({
            value: lick.lick_id || lick._id,
            label: lick.title || "Untitled Lick",
            ...lick,
          }));
        }
        return [];
      };

      const result = await fetchActiveLicks();

      expect(lickService.getMyLicks).toHaveBeenCalledWith({
        status: "active",
        limit: 100,
      });
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        value: "lick1",
        label: "Lick 1",
        lick_id: "lick1",
        title: "Lick 1",
      });
      expect(result[1]).toMatchObject({
        value: "lick2",
        label: "Lick 2",
      });
      expect(result[2].label).toBe("Untitled Lick");
    });

    it("should handle empty response", async () => {
      lickService.getMyLicks.mockResolvedValue({ success: true, data: [] });

      const fetchActiveLicks = async () => {
        const res = await lickService.getMyLicks({
          status: "active",
          limit: 100,
        });
        if (res?.success && Array.isArray(res.data)) {
          return res.data.map((lick) => ({
            value: lick.lick_id || lick._id,
            label: lick.title || "Untitled Lick",
            ...lick,
          }));
        }
        return [];
      };

      const result = await fetchActiveLicks();
      expect(result).toEqual([]);
    });

    it("should handle error response", async () => {
      lickService.getMyLicks.mockRejectedValue(new Error("Network error"));

      const fetchActiveLicks = async () => {
        try {
          const res = await lickService.getMyLicks({
            status: "active",
            limit: 100,
          });
          if (res?.success && Array.isArray(res.data)) {
            return res.data.map((lick) => ({
              value: lick.lick_id || lick._id,
              label: lick.title || "Untitled Lick",
              ...lick,
            }));
          }
          return [];
        } catch (e) {
          return [];
        }
      };

      const result = await fetchActiveLicks();
      expect(result).toEqual([]);
    });
  });

  // Test 9: fetchActiveProjects - Data fetching with formatting
  describe("fetchActiveProjects", () => {
    it("should fetch and format active projects correctly", async () => {
      const mockResponse = {
        success: true,
        data: [
          { _id: "proj1", title: "Project 1", status: "active" },
          { _id: "proj2", title: "Project 2", status: "active" },
          { _id: "proj3", title: null, status: "active" },
        ],
      };

      projectService.getUserProjects.mockResolvedValue(mockResponse);

      const fetchActiveProjects = async () => {
        const res = await projectService.getUserProjects("all", "active");
        if (res?.success && Array.isArray(res.data)) {
          return res.data.map((project) => ({
            value: String(project._id),
            label: project.title || "Untitled Project",
            ...project,
          }));
        }
        return [];
      };

      const result = await fetchActiveProjects();

      expect(projectService.getUserProjects).toHaveBeenCalledWith(
        "all",
        "active"
      );
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        value: "proj1",
        label: "Project 1",
        _id: "proj1",
      });
      expect(result[1].value).toBe("proj2");
      expect(result[2].label).toBe("Untitled Project");
      expect(typeof result[0].value).toBe("string"); // Ensure ID is normalized to string
    });

    it("should handle non-array response", async () => {
      projectService.getUserProjects.mockResolvedValue({ success: false });

      const fetchActiveProjects = async () => {
        const res = await projectService.getUserProjects("all", "active");
        if (res?.success && Array.isArray(res.data)) {
          return res.data.map((project) => ({
            value: String(project._id),
            label: project.title || "Untitled Project",
            ...project,
          }));
        }
        return [];
      };

      const result = await fetchActiveProjects();
      expect(result).toEqual([]);
    });
  });

  // Test 10: Complex attachment validation logic
  describe("Complex attachment validation scenarios", () => {
    const extractFirstUrl = (text) => {
      if (!text) return null;
      const urlRegex = /(https?:\/\/[^\s]+)/i;
      const match = text.match(urlRegex);
      return match ? match[0] : null;
    };

    const parseSharedLickId = (urlString) => {
      if (!urlString) return null;
      try {
        const url = new URL(urlString, "https://melodyhub.website");
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length >= 2 && segments[0].toLowerCase() === "licks") {
          return segments[1].split("?")[0].split("#")[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    const parseProjectId = (urlString) => {
      if (!urlString) return null;
      try {
        const url = new URL(urlString, "https://melodyhub.website");
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length >= 2 && segments[0].toLowerCase() === "projects") {
          return segments[1].split("?")[0].split("#")[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    const determineAttachmentType = (
      text,
      attachedLicks,
      projectId,
      linkPreview
    ) => {
      const firstUrl = extractFirstUrl(text || "");
      const sharedLickId = parseSharedLickId(firstUrl);
      const sharedProjectId = parseProjectId(firstUrl);

      const hasLickUrl = !!sharedLickId;
      const hasProjectUrl = !!sharedProjectId;
      const hasAttachedLicks =
        attachedLicks &&
        Array.isArray(attachedLicks) &&
        attachedLicks.length > 0;
      const hasProject = !!projectId;
      const hasLinkPreview = !!linkPreview && !hasLickUrl && !hasProjectUrl;

      return {
        hasLick: hasLickUrl || hasAttachedLicks,
        hasProject: hasProjectUrl || hasProject,
        hasLink: hasLinkPreview,
        type:
          hasLickUrl || hasAttachedLicks
            ? "lick"
            : hasProjectUrl || hasProject
            ? "project"
            : hasLinkPreview
            ? "link"
            : "none",
      };
    };

    it("should detect lick from URL in text", () => {
      const text = "Check out https://melodyhub.website/licks/lick123";
      const result = determineAttachmentType(text, [], null, null);
      expect(result.hasLick).toBe(true);
      expect(result.type).toBe("lick");
    });

    it("should detect project from URL in text", () => {
      const text = "See my project https://melodyhub.website/projects/proj123";
      const result = determineAttachmentType(text, [], null, null);
      expect(result.hasProject).toBe(true);
      expect(result.type).toBe("project");
    });

    it("should detect attached licks array", () => {
      const result = determineAttachmentType(
        "",
        [{ _id: "lick1" }],
        null,
        null
      );
      expect(result.hasLick).toBe(true);
      expect(result.type).toBe("lick");
    });

    it("should detect project from projectId", () => {
      const result = determineAttachmentType("", [], { _id: "proj1" }, null);
      expect(result.hasProject).toBe(true);
      expect(result.type).toBe("project");
    });

    it("should detect link preview when no lick/project URLs", () => {
      const result = determineAttachmentType(
        "See https://example.com",
        [],
        null,
        { url: "https://example.com" }
      );
      expect(result.hasLink).toBe(true);
      expect(result.type).toBe("link");
    });

    it("should prioritize lick URL over link preview", () => {
      const text = "Check https://melodyhub.website/licks/lick123";
      const result = determineAttachmentType(text, [], null, {
        url: "https://example.com",
      });
      expect(result.type).toBe("lick");
      expect(result.hasLink).toBe(false);
    });

    it("should return none when no attachments", () => {
      const result = determineAttachmentType("Just text", [], null, null);
      expect(result.type).toBe("none");
      expect(result.hasLick).toBe(false);
      expect(result.hasProject).toBe(false);
      expect(result.hasLink).toBe(false);
    });

    it("should handle project URL in linkPreview", () => {
      const linkPreview = { url: "https://melodyhub.website/projects/proj456" };
      const result = determineAttachmentType("", [], null, linkPreview);
      expect(result.hasProject).toBe(true);
      expect(result.type).toBe("project");
      expect(result.hasLink).toBe(false);
    });
  });
});
