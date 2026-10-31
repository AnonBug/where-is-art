import { useCallback, useEffect, useState } from "react";

function readRoute() {
  return {
    collectionId: new URLSearchParams(location.search).get("collection"),
    legacyWorkId: new URLSearchParams(location.hash.slice(1)).get("work"),
  };
}

export function useCollectionNavigation() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  const navigate = useCallback((collectionId: string | null) => {
    const url = new URL(location.href);
    if (collectionId) url.searchParams.set("collection", collectionId);
    else url.searchParams.delete("collection");
    url.hash = "";
    history.pushState(null, "", url);
    setRoute(readRoute());
  }, []);
  return { ...route, navigate };
}
