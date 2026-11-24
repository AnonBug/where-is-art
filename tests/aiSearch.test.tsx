// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import catalog from "../public/catalog.json";
import { atlasSchema } from "../src/domain/atlas";
import { AiSearch, useAiSearch } from "../src/features/catalog/AiSearch";

const data = atlasSchema.parse(catalog);
const revision = "a".repeat(20);
const reply = {
  revision,
  mode: "ai",
  total: 1,
  message: "依据站内已收录作品匹配",
  results: [{ id: "mona", reason: "卢浮宫（巴黎）" }],
};
beforeEach(() =>
  useAiSearch.setState({ open: true, query: "巴黎的蒙娜丽莎", result: null }),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useAiSearch.setState({ open: false, query: "", result: null });
});

describe("AI search", () => {
  it("sends only the query and catalog revision, opens a real work and retains results on return", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(reply)));
    vi.stubGlobal("fetch", fetch);
    const onSelect = vi.fn();
    const first = render(
      <AiSearch
        data={data}
        revision={revision}
        onSelect={onSelect}
        endpoint="https://search.example/api/ai-search"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "AI 搜索" }));
    const card = await screen.findByRole("button", {
      name: /蒙娜丽莎.*卢浮宫/,
    });
    expect(fetch.mock.calls.length).toBe(1);
    const [, init] = (
      fetch.mock.calls as unknown as [string, RequestInit][]
    )[0];
    expect(JSON.parse(init.body as string)).toEqual({
      query: "巴黎的蒙娜丽莎",
      revision,
      mode: "ai",
    });
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(
      data.artworks.find((work) => work.id === "mona"),
    );
    first.unmount();
    render(
      <AiSearch
        data={data}
        revision={revision}
        onSelect={onSelect}
        endpoint="https://search.example/api/ai-search"
      />,
    );
    expect(
      screen.getByRole("button", { name: /蒙娜丽莎.*卢浮宫/ }),
    ).toBeTruthy();
    expect(fetch.mock.calls.length).toBe(1);
  });
  it("shows quota fallback and permits explicit keyword retry", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...reply,
            mode: "keyword",
            message: "今日 AI 搜索次数已用完，仍可使用关键词搜索",
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <AiSearch
        data={data}
        revision={revision}
        onSelect={vi.fn()}
        endpoint="https://search.example"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "AI 搜索" }));
    expect(await screen.findByText(/今日 AI 搜索次数已用完/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "按关键词重新搜索" }));
    await waitFor(() => expect(fetch.mock.calls.length).toBe(2));
    expect(
      JSON.parse(
        (fetch.mock.calls as unknown as [string, RequestInit][])[1][1]
          .body as string,
      ).mode,
    ).toBe("keyword");
  });
  it("reports network failure and does not expose invalid or unknown records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    render(
      <AiSearch
        data={data}
        revision={revision}
        onSelect={vi.fn()}
        endpoint="https://search.example"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "AI 搜索" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ...reply,
              revision: "b".repeat(20),
              results: [{ id: "invented", reason: "虚构" }],
            }),
          ),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText(/作品目录已更新/)).toBeTruthy();
    expect(screen.queryByText("虚构")).toBeNull();
  });
});
