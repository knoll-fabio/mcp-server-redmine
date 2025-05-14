import { jest, expect, describe, it, beforeEach } from "@jest/globals";
import type { Mock } from "jest-mock";
import { RedmineClient } from "../../../lib/client/index.js";
import {
  mockResponse,
  mockErrorResponse,
  mockNetworkError,
} from "../../../lib/__tests__/helpers/mocks.js";
import * as fixtures from "../../../lib/__tests__/helpers/fixtures.js";
import { parseUrl } from "../../../lib/__tests__/helpers/url.js";
import { createIssuesHandlers } from "../../issues.js";
import { assertMcpToolResponse } from "../../../lib/__tests__/helpers/mcp.js";
import config from "../../../lib/config.js";
import type { IssueShowParams } from "../../../lib/types/index.js";

describe("show_issue", () => {
  let client: RedmineClient;
  let mockFetch: Mock;
  let handlers: ReturnType<typeof createIssuesHandlers>;

  beforeEach(() => {
    client = new RedmineClient();
    mockFetch = jest.spyOn(global, "fetch") as Mock;
    mockFetch.mockReset();
    handlers = createIssuesHandlers({ client, config });
  });

  describe("MCP Response Format", () => {
    it("returns valid MCP response for successful fetch", async () => {
      // Arrange
      mockFetch.mockImplementationOnce(() =>
        mockResponse(fixtures.singleIssueResponse)
      );

      const issueId = fixtures.singleIssueResponse.issue.id;

      // Act
      const response = await handlers.show_issue({ id: issueId });

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(false);
      expect(response.content[0]).toEqual({
        type: "text",
        text: expect.stringContaining("<issue>"),
      });
    });

    it("returns valid MCP error response for API error", async () => {
      // Arrange
      const errorMessage = "Issue not found";
      mockFetch.mockImplementationOnce(() =>
        mockErrorResponse(404, [errorMessage])
      );

      // Act
      const response = await handlers.show_issue({ id: 99999 });

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(true);
      expect(response.content[0]).toEqual({
        type: "text",
        text: expect.stringContaining(errorMessage),
      });
    });

    it("returns valid MCP error response for network error", async () => {
      // Arrange
      mockFetch.mockImplementationOnce(() => mockNetworkError("Network error"));

      // Act
      const response = await handlers.show_issue({ id: 1 });

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(true);
      expect(response.content[0]).toEqual({
        type: "text",
        text: expect.stringContaining("Network error"),
      });
    });
  });

  describe("Parameter Handling", () => {
    it("validates required ID parameter", async () => {
      // Act
      const response = await handlers.show_issue({});

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toMatch(/issue id is required/i);
    });

    it("handles include parameter correctly", async () => {
      // Arrange
      mockFetch.mockImplementationOnce(() =>
        mockResponse(fixtures.singleIssueResponse)
      );

      const params = {
        id: 1,
        include: "children,attachments",
      };

      // Act
      const response = await handlers.show_issue(params);

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(false);

      const [url] = mockFetch.mock.calls[0] as [string];
      const { params: actualParams } = parseUrl(url);
      expect(actualParams).toEqual({
        include: "children,attachments",
      });
    });

    it("handles numeric ID conversion correctly", async () => {
      // Arrange
      mockFetch.mockImplementationOnce(() =>
        mockResponse(fixtures.singleIssueResponse)
      );

      // Act - passing string ID that should be converted to number
      const response = await handlers.show_issue({ id: "42" });

      // Assert
      assertMcpToolResponse(response);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("/issues/42.json");
    });
  });

  describe("Error Handling", () => {
    it("handles invalid ID parameter", async () => {
      // Act
      const response = await handlers.show_issue({ id: "not-a-number" });

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toMatch(/invalid number/i);
    });

    it("handles non-object arguments", async () => {
      // Act
      // @ts-ignore - Intentionally passing wrong type for test
      const response = await handlers.show_issue("string-argument");

      // Assert
      assertMcpToolResponse(response);
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toMatch(/arguments must be an object/i);
    });
  });
});
