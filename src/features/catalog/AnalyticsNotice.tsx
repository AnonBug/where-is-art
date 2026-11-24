import { useState } from "react";
import {
  analyticsDisabled,
  disableAnalytics,
} from "../../infrastructure/analytics";
import s from "./Catalog.module.scss";

export function AnalyticsNotice() {
  const [disabled, setDisabled] = useState(analyticsDisabled);
  if (!import.meta.env.VITE_UMAMI_WEBSITE_ID) return null;
  return (
    <details className={s.analyticsNotice}>
      <summary>访问统计说明</summary>
      <p>
        我们使用 Umami Cloud
        统计访问量、浏览的画作与专题，以及搜索使用和下载点击，
        用于了解哪些内容受到欢迎。统计数据保存在美国区域；访客数为去重估算。
        不上传搜索原文或收藏清单，不录制屏幕或操作回放。
      </p>
      <p>
        <a href="https://umami.is/privacy" target="_blank" rel="noreferrer">
          Umami 隐私说明
        </a>
        {" · "}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            disableAnalytics();
            setDisabled(true);
          }}
        >
          {disabled ? "本浏览器已关闭统计" : "关闭本浏览器的统计"}
        </button>
      </p>
    </details>
  );
}
