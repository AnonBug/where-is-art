import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles/global.scss";
import { AtlasApp } from "./app/AtlasApp";

const legacyWork = location.hash.match(/^#work=([^&]+)/)?.[1];
if (legacyWork)
  history.replaceState(
    null,
    "",
    `${location.pathname}#/artworks/${encodeURIComponent(decodeURIComponent(legacyWork))}?scope=topic:leonardo`,
  );
else if (
  !location.hash &&
  new URLSearchParams(location.search).get("collection") === "leonardo"
)
  history.replaceState(
    null,
    "",
    `${location.pathname}#/topics/leonardo?scope=topic:leonardo`,
  );

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AtlasApp />
    </HashRouter>
  </StrictMode>,
);
