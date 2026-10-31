import { useCallback, useEffect, useState } from "react";

function currentWork() {
  return new URLSearchParams(window.location.hash.slice(1)).get("work");
}

export function useWorkHash() {
  const [workId, setWorkId] = useState(currentWork);
  useEffect(() => {
    const sync = () => setWorkId(currentWork());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const openWork = useCallback((id: string) => {
    setWorkId(id);
    history.replaceState(null, "", `#work=${encodeURIComponent(id)}`);
  }, []);
  const closeWork = useCallback(() => {
    setWorkId(null);
    history.replaceState(null, "", location.pathname + location.search);
  }, []);
  return { workId, openWork, closeWork };
}
