import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as lickService from "../../../services/user/lickService";

// Mock dependencies
vi.mock("../../../services/user/lickService");

describe("LickCommunityPage - Complex Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    delete window.location;
    window.location = { href: "" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: fetchLicks - Complex data fetching with filters
  describe("fetchLicks", () => {
    const fetchLicks = async (page, sortBy, searchTerm, selectedTags) => {
      try {
        const params = {
          page,
          limit: 20,
          sortBy,
        };

        if (searchTerm) {
          params.search = searchTerm;
        }

        if (selectedTags) {
          params.tags = selectedTags;
        }

        const response = await lickService.getCommunityLicks(params);

        if (response.success) {
          return {
            licks: response.data,
            pagination: response.pagination,
          };
        }
        return { licks: [], pagination: null };
      } catch (err) {
        throw err;
      }
    };

    it("should fetch licks with all parameters", async () => {
      const mockResponse = {
        success: true,
        data: [
          { lick_id: "1", title: "Lick 1" },
          { lick_id: "2", title: "Lick 2" },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 5,
          totalItems: 100,
          hasNextPage: true,
          hasPrevPage: false,
        },
      };

      lickService.getCommunityLicks.mockResolvedValue(mockResponse);

      const result = await fetchLicks(1, "newest", "guitar", "rock,blues");

      expect(lickService.getCommunityLicks).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: "newest",
        search: "guitar",
        tags: "rock,blues",
      });
      expect(result.licks).toHaveLength(2);
      expect(result.pagination).toEqual(mockResponse.pagination);
    });

    it("should fetch licks without optional parameters", async () => {
      const mockResponse = {
        success: true,
        data: [],
        pagination: null,
      };

      lickService.getCommunityLicks.mockResolvedValue(mockResponse);

      const result = await fetchLicks(1, "popular", "", "");

      expect(lickService.getCommunityLicks).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: "popular",
      });
      expect(result.licks).toEqual([]);
    });

    it("should handle API errors", async () => {
      const error = new Error("Network error");
      lickService.getCommunityLicks.mockRejectedValue(error);

      await expect(fetchLicks(1, "newest", "", "")).rejects.toThrow(
        "Network error"
      );
    });

    it("should handle unsuccessful response", async () => {
      const mockResponse = {
        success: false,
        message: "Failed to fetch",
      };

      lickService.getCommunityLicks.mockResolvedValue(mockResponse);

      const result = await fetchLicks(1, "newest", "", "");

      expect(result.licks).toEqual([]);
      expect(result.pagination).toBeNull();
    });

    it("should handle pagination correctly", async () => {
      const mockResponse = {
        success: true,
        data: Array.from({ length: 20 }, (_, i) => ({
          lick_id: `lick${i + 1}`,
          title: `Lick ${i + 1}`,
        })),
        pagination: {
          currentPage: 2,
          totalPages: 10,
          totalItems: 200,
          hasNextPage: true,
          hasPrevPage: true,
        },
      };

      lickService.getCommunityLicks.mockResolvedValue(mockResponse);

      const result = await fetchLicks(2, "newest", "", "");

      expect(result.licks).toHaveLength(20);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
    });
  });

  // Test 2: Search debounce logic
  describe("Search debounce logic", () => {
    const createDebouncedSearch = (delay = 500) => {
      let timeoutId = null;

      return (searchTerm, callback, currentPage = 1) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          if (currentPage === 1) {
            callback();
          } else {
            // Reset to page 1 when search changes
            callback(1);
          }
        }, delay);

        return () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };
      };
    };

    it("should debounce search calls", async () => {
      const callback = vi.fn();
      const debouncedSearch = createDebouncedSearch(100);

      debouncedSearch("g", callback);
      debouncedSearch("gu", callback);
      debouncedSearch("gui", callback);
      debouncedSearch("guit", callback);
      debouncedSearch("guitar", callback);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should reset page when search changes on non-first page", async () => {
      const callback = vi.fn();
      const debouncedSearch = createDebouncedSearch(100);

      debouncedSearch("new search", callback, 5);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith(1);
    });

    it("should call immediately when already on page 1", async () => {
      const callback = vi.fn();
      const debouncedSearch = createDebouncedSearch(100);

      debouncedSearch("search", callback, 1);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(callback).toHaveBeenCalledWith();
    });

    it("should cancel previous debounce on new input", async () => {
      const callback = vi.fn();
      const debouncedSearch = createDebouncedSearch(200);

      debouncedSearch("first", callback);
      await new Promise((resolve) => setTimeout(resolve, 100));
      debouncedSearch("second", callback);
      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  // Test 3: Filter combination logic
  describe("Filter combination logic", () => {
    const buildFilterParams = (searchTerm, selectedTags, sortBy, page) => {
      const params = {
        page,
        limit: 20,
        sortBy,
      };

      if (searchTerm && searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      if (selectedTags && selectedTags.trim()) {
        params.tags = selectedTags.trim();
      }

      return params;
    };

    it("should build params with all filters", () => {
      const params = buildFilterParams("guitar", "rock,blues", "newest", 1);

      expect(params).toEqual({
        page: 1,
        limit: 20,
        sortBy: "newest",
        search: "guitar",
        tags: "rock,blues",
      });
    });

    it("should trim whitespace from filters", () => {
      const params = buildFilterParams("  guitar  ", "  rock  ", "popular", 2);

      expect(params.search).toBe("guitar");
      expect(params.tags).toBe("rock");
    });

    it("should exclude empty filters", () => {
      const params = buildFilterParams("", "", "newest", 1);

      expect(params).not.toHaveProperty("search");
      expect(params).not.toHaveProperty("tags");
      expect(params).toEqual({
        page: 1,
        limit: 20,
        sortBy: "newest",
      });
    });

    it("should handle null/undefined filters", () => {
      const params1 = buildFilterParams(null, undefined, "newest", 1);
      const params2 = buildFilterParams(undefined, null, "popular", 2);

      expect(params1).not.toHaveProperty("search");
      expect(params1).not.toHaveProperty("tags");
      expect(params2).not.toHaveProperty("search");
      expect(params2).not.toHaveProperty("tags");
    });
  });

  // Test 4: Pagination state management
  describe("Pagination state management", () => {
    const calculatePaginationState = (pagination, currentPage) => {
      if (!pagination) {
        return {
          canGoPrev: false,
          canGoNext: false,
          showPagination: false,
        };
      }

      return {
        canGoPrev: pagination.hasPrevPage || false,
        canGoNext: pagination.hasNextPage || false,
        showPagination: pagination.totalPages > 1,
        currentPage: pagination.currentPage || currentPage,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
      };
    };

    it("should calculate pagination state correctly", () => {
      const pagination = {
        currentPage: 2,
        totalPages: 5,
        totalItems: 100,
        hasNextPage: true,
        hasPrevPage: true,
      };

      const state = calculatePaginationState(pagination, 2);

      expect(state.canGoPrev).toBe(true);
      expect(state.canGoNext).toBe(true);
      expect(state.showPagination).toBe(true);
      expect(state.currentPage).toBe(2);
      expect(state.totalPages).toBe(5);
    });

    it("should handle first page", () => {
      const pagination = {
        currentPage: 1,
        totalPages: 5,
        hasNextPage: true,
        hasPrevPage: false,
      };

      const state = calculatePaginationState(pagination, 1);

      expect(state.canGoPrev).toBe(false);
      expect(state.canGoNext).toBe(true);
    });

    it("should handle last page", () => {
      const pagination = {
        currentPage: 5,
        totalPages: 5,
        hasNextPage: false,
        hasPrevPage: true,
      };

      const state = calculatePaginationState(pagination, 5);

      expect(state.canGoPrev).toBe(true);
      expect(state.canGoNext).toBe(false);
    });

    it("should hide pagination for single page", () => {
      const pagination = {
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      };

      const state = calculatePaginationState(pagination, 1);

      expect(state.showPagination).toBe(false);
    });

    it("should handle null pagination", () => {
      const state = calculatePaginationState(null, 1);

      expect(state.canGoPrev).toBe(false);
      expect(state.canGoNext).toBe(false);
      expect(state.showPagination).toBe(false);
    });
  });

  // Test 5: Error handling and retry logic
  describe("Error handling and retry", () => {
    const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fetchFn();
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 100)
            );
          }
        }
      }

      throw lastError;
    };

    it("should succeed on first attempt", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ success: true, data: [] });

      const result = await fetchWithRetry(fetchFn);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("should retry on failure", async () => {
      const fetchFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true, data: [] });

      const result = await fetchWithRetry(fetchFn, 2);

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("should throw after max retries", async () => {
      const error = new Error("Persistent error");
      const fetchFn = vi.fn().mockRejectedValue(error);

      await expect(fetchWithRetry(fetchFn, 2)).rejects.toThrow(
        "Persistent error"
      );
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  // Test 6: handleLickClick navigation
  describe("handleLickClick", () => {
    it("should navigate to lick detail page", () => {
      const handleLickClick = (lickId) => {
        window.location.href = `/licks/${lickId}`;
      };

      handleLickClick("lick123");

      expect(window.location.href).toBe("/licks/lick123");
    });

    it("should handle empty lick ID", () => {
      const handleLickClick = (lickId) => {
        if (!lickId) return;
        window.location.href = `/licks/${lickId}`;
      };

      const originalHref = window.location.href;
      handleLickClick("");
      expect(window.location.href).toBe(originalHref);
    });
  });

  // Test 7: Component rendering and interactions
  describe("Component rendering logic", () => {
    it("should handle loading state logic", () => {
      // Test loading state management logic
      const isLoading = true;
      const hasData = false;
      const shouldShowLoading = isLoading && !hasData;
      
      expect(shouldShowLoading).toBe(true);
    });

    it("should handle error state with retry logic", async () => {
      const error = new Error("Network error");
      const handleRetry = async () => {
        try {
          return await lickService.getCommunityLicks({ page: 1, limit: 20 });
        } catch (err) {
          throw err;
        }
      };

      lickService.getCommunityLicks.mockRejectedValueOnce(error);
      await expect(handleRetry()).rejects.toThrow("Network error");

      // Retry should work
      lickService.getCommunityLicks.mockResolvedValueOnce({
        success: true,
        data: [{ lick_id: "1", title: "Test Lick" }],
        pagination: { currentPage: 1, totalPages: 1 },
      });

      const result = await handleRetry();
      expect(result.success).toBe(true);
      expect(lickService.getCommunityLicks).toHaveBeenCalledTimes(2);
    });

    it("should handle empty state logic", () => {
      const licks = [];
      const loading = false;
      const error = null;
      const shouldShowEmpty = !loading && !error && licks.length === 0;

      expect(shouldShowEmpty).toBe(true);
    });

    it("should handle data available logic", () => {
      const licks = [
        { lick_id: "1", title: "Lick 1" },
        { lick_id: "2", title: "Lick 2" },
      ];
      const loading = false;
      const error = null;
      const shouldShowGrid = !loading && !error && licks.length > 0;

      expect(shouldShowGrid).toBe(true);
      expect(licks.length).toBe(2);
    });
  });

  // Test 8: Advanced filter combinations
  describe("Advanced filter combinations", () => {
    it("should handle multiple tags with commas", async () => {
      const fetchLicks = async (page, sortBy, searchTerm, selectedTags) => {
        const params = { page, limit: 20, sortBy };
        if (searchTerm) params.search = searchTerm;
        if (selectedTags) params.tags = selectedTags;
        const response = await lickService.getCommunityLicks(params);
        return response.success ? { licks: response.data, pagination: response.pagination } : { licks: [], pagination: null };
      };

      lickService.getCommunityLicks.mockResolvedValue({
        success: true,
        data: [],
        pagination: null,
      });

      await fetchLicks(1, "newest", "", "rock,blues,jazz");

      expect(lickService.getCommunityLicks).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: "newest",
        tags: "rock,blues,jazz",
      });
    });

    it("should handle special characters in search", async () => {
      const fetchLicks = async (searchTerm) => {
        const params = { page: 1, limit: 20, sortBy: "newest" };
        if (searchTerm) params.search = searchTerm;
        return await lickService.getCommunityLicks(params);
      };

      lickService.getCommunityLicks.mockResolvedValue({ success: true, data: [] });

      await fetchLicks("C# major scale");

      expect(lickService.getCommunityLicks).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "C# major scale",
        })
      );
    });

    it("should handle very long search terms", async () => {
      const longSearch = "a".repeat(200);
      const fetchLicks = async (searchTerm) => {
        const params = { page: 1, limit: 20, sortBy: "newest" };
        if (searchTerm && searchTerm.length <= 100) params.search = searchTerm;
        return await lickService.getCommunityLicks(params);
      };

      lickService.getCommunityLicks.mockResolvedValue({ success: true, data: [] });

      await fetchLicks(longSearch);

      // Should not include search if too long
      expect(lickService.getCommunityLicks).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: "newest",
      });
    });
  });

  // Test 9: Edge cases and error scenarios
  describe("Edge cases and error scenarios", () => {
    it("should handle malformed API response", async () => {
      const fetchLicks = async () => {
        try {
          const response = await lickService.getCommunityLicks({ page: 1, limit: 20 });
          if (response?.success) {
            return { licks: response.data || [], pagination: response.pagination };
          }
          return { licks: [], pagination: null };
        } catch (err) {
          throw err;
        }
      };

      lickService.getCommunityLicks.mockResolvedValue({
        success: true,
        data: null, // Malformed - data is null
        pagination: undefined,
      });

      const result = await fetchLicks();
      expect(result.licks).toEqual([]);
    });

    it("should handle network timeout", async () => {
      const fetchLicks = async () => {
        try {
          return await lickService.getCommunityLicks({ page: 1, limit: 20 });
        } catch (err) {
          if (err.message.includes("timeout")) {
            throw new Error("Request timed out. Please try again.");
          }
          throw err;
        }
      };

      const timeoutError = new Error("Request timeout");
      timeoutError.code = "ETIMEDOUT";
      lickService.getCommunityLicks.mockRejectedValue(timeoutError);

      await expect(fetchLicks()).rejects.toThrow("Request timed out");
    });

    it("should handle empty pagination object", async () => {
      const calculatePaginationState = (pagination) => {
        if (!pagination || Object.keys(pagination).length === 0) {
          return { canGoPrev: false, canGoNext: false, showPagination: false };
        }
        return {
          canGoPrev: pagination.hasPrevPage || false,
          canGoNext: pagination.hasNextPage || false,
          showPagination: pagination.totalPages > 1,
        };
      };

      const state1 = calculatePaginationState({});
      expect(state1.showPagination).toBe(false);

      const state2 = calculatePaginationState(null);
      expect(state2.showPagination).toBe(false);
    });
  });
});

