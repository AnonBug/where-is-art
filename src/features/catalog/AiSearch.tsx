import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import {
  trackSearch,
  trackSearchSelection,
} from "../../infrastructure/analytics";
import { z } from "zod";
import {
  artistLabel,
  primaryImage,
  workVenues,
  type ArtworkSummary,
  type BrowseAtlas,
} from "../../domain/atlas";
import { ArtworkImage, Icon } from "../../shared/ui";
import s from "./AiSearch.module.scss";

const evidenceSchema = z.object({
  field: z.enum(["description", "background", "story", "looking"]),
  label: z.string(),
  text: z.string().max(500),
  sources: z
    .array(
      z.object({
        label: z.string(),
        url: z
          .string()
          .url()
          .refine((url) => /^https?:\/\//.test(url)),
      }),
    )
    .max(3),
});
const responseSchema = z.object({
  revision: z.string(),
  mode: z.enum(["ai", "keyword"]),
  total: z.number().int().nonnegative(),
  message: z.string(),
  semantic: z.boolean().optional(),
  results: z
    .array(
      z.object({
        id: z.string(),
        reason: z.string(),
        evidence: evidenceSchema.optional(),
        supportingEvidence: z.array(evidenceSchema).max(1).optional(),
      }),
    )
    .max(30),
});
type SearchResult = z.infer<typeof responseSchema>;
export const useAiSearch = create<{
  open: boolean;
  query: string;
  result: SearchResult | null;
}>(() => ({ open: false, query: "", result: null }));

export function AiSearch({
  data,
  revision,
  onSelect,
  endpoint = import.meta.env.VITE_AI_SEARCH_URL,
}: {
  data: BrowseAtlas;
  revision?: string;
  onSelect: (work: ArtworkSummary) => void;
  endpoint?: string;
}) {
  const { query, result } = useAiSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const visibleResult = result?.revision === revision ? result : null;
  async function search(value: string, mode: "ai" | "keyword" = "ai") {
    if (!value.trim() || busy) return;
    useAiSearch.setState({ query: value, result: null });
    setError("");
    if (!endpoint) {
      setError("搜索暂未开放，请稍后再试");
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort("timeout"), 55_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value.trim(), revision, mode }),
        signal: controller.signal,
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "搜索太快，请稍等片刻再试"
            : "搜索暂时不可用，请稍后重试",
        );
      const parsed = responseSchema.parse(await response.json());
      if (revision && parsed.revision !== revision)
        throw new Error("作品目录已更新，请刷新页面后重试");
      if (!controller.signal.aborted) {
        useAiSearch.setState({ result: parsed });
        trackSearch(parsed.mode, parsed.total);
      }
    } catch (cause) {
      if (!controller.signal.aborted || controller.signal.reason === "timeout")
        setError(
          controller.signal.reason === "timeout"
            ? "搜索用时较久，请重试"
            : cause instanceof Error &&
                !(cause instanceof TypeError) &&
                !(cause instanceof z.ZodError)
              ? cause.message
              : "网络暂时无法连接，请稍后重试",
        );
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <section className={s.panel} aria-label="AI 搜索">
      <div className={s.heading}>
        <button
          className={s.back}
          onClick={() => useAiSearch.setState({ open: false })}
        >
          <Icon name="back" size={16} /> 返回目录
        </button>
        <h1>想找哪一幅画？</h1>
        <p>描述画家、收藏地点，或画中的情节与故事。</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void search(query);
          }}
          className={s.form}
        >
          <label htmlFor="art-ai-query">搜索全部作品</label>
          <textarea
            id="art-ai-query"
            rows={2}
            maxLength={200}
            value={query}
            placeholder="例如：宙斯化作金雨的画"
            onChange={(event) =>
              useAiSearch.setState({ query: event.target.value })
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void search(query);
              }
            }}
          />
          <button type="submit" disabled={busy || !query.trim()}>
            <Icon name="search" size={16} />
            {busy ? "正在查找…" : "AI 搜索"}
          </button>
        </form>
        {!visibleResult && !busy && !error && (
          <div className={s.examples} aria-label="搜索示例">
            {[
              "宙斯化作金雨的画",
              "为焚毁的城市哀伤的老人",
              "巴黎收藏的莫奈作品",
            ].map((text) => (
              <button key={text} onClick={() => void search(text)}>
                {text}
                <Icon name="chevron" size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={s.results} aria-busy={busy}>
        {busy && (
          <p className={s.status} role="status">
            正在检索作品资料，并核对相关文字依据…
          </p>
        )}
        {error && (
          <div className={s.status} role="alert">
            <p>{error}</p>
            <button onClick={() => void search(query)}>重试</button>
          </div>
        )}
        {visibleResult && (
          <>
            <div className={s.status} role="status">
              <strong>
                {visibleResult.total
                  ? `找到 ${visibleResult.total} 幅${visibleResult.semantic ? "有文字依据的" : ""}作品`
                  : "暂未找到匹配作品"}
              </strong>
              <p>{visibleResult.message}</p>
              {visibleResult.total > 30 && (
                <p>先展示前 30 幅，可补充条件缩小范围。</p>
              )}
              {visibleResult.total === 0 && (
                <p>
                  试试更具体的人物、情节或画面线索；没有文字依据的作品可能不会出现。
                </p>
              )}
            </div>
            {visibleResult.results.map((item) => {
              const work = data.artworks.find((w) => w.id === item.id);
              if (!work) return null;
              return (
                <article key={item.id} className={s.result}>
                  <button
                    className={s.card}
                    onClick={() => {
                      trackSearchSelection(work);
                      onSelect(work);
                    }}
                  >
                    <span className={s.thumb}>
                      <ArtworkImage
                        src={primaryImage(data, item.id)?.thumbnail.url}
                        alt=""
                        loading="lazy"
                      />
                    </span>
                    <span className={s.copy}>
                      <strong>{work.title}</strong>
                      <small>{artistLabel(data, work)}</small>
                      <small>
                        {workVenues(data, work.id)
                          .map((v) => v.name)
                          .join(" · ") || "收藏地点未详"}
                      </small>
                      {item.reason && (
                        <span className={s.reason}>{item.reason}</span>
                      )}
                    </span>
                    <Icon name="chevron" size={14} />
                  </button>
                  {(item.evidence
                    ? [item.evidence, ...(item.supportingEvidence || [])]
                    : []
                  ).map((evidence, index) => (
                    <details key={index} className={s.evidence}>
                      <summary>
                        <span>
                          {evidence.label} · {index ? "补充依据" : "原文依据"}
                        </span>
                        <q>{evidence.text}</q>
                        <small>展开原文与参考来源</small>
                      </summary>
                      <div className={s.sources}>
                        {evidence.sources.length ? (
                          evidence.sources.map((source) => (
                            <a
                              key={source.url}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {source.label}
                              <Icon name="external" size={12} />
                            </a>
                          ))
                        ) : (
                          <small>站内作品资料，暂无外部来源链接</small>
                        )}
                      </div>
                    </details>
                  ))}
                </article>
              );
            })}
            <button
              className={s.keyword}
              disabled={busy}
              onClick={() => void search(query, "keyword")}
            >
              按关键词重新搜索
            </button>
          </>
        )}
      </div>
    </section>
  );
}
