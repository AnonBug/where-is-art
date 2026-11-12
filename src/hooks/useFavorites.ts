import { useEffect, useRef, useState } from "react";
import {
  FAVORITES_KEY,
  LEGACY_FAVORITES_KEY,
  readFavorites,
} from "../lib/favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      return readFavorites(localStorage);
    } catch {
      return new Set();
    }
  });
  const [storageError, setStorageError] = useState(false);
  const current = useRef(favorites);
  const unsaved = useRef(false);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if ([FAVORITES_KEY, LEGACY_FAVORITES_KEY, null].includes(event.key)) {
        try {
          if (event.storageArea && event.storageArea !== localStorage) return;
          // Do not discard changes made while the browser refused storage.
          if (unsaved.current) return;
          current.current = readFavorites(localStorage);
          setFavorites(current.current);
        } catch {
          /* Keep this session's collection if storage is disabled. */
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleFavorite(id: string) {
    let next = new Set(current.current);
    try {
      // Read the latest tab's changes even before its storage event arrives.
      if (!unsaved.current) next = readFavorites(localStorage);
    } catch {
      /* Keep the in-memory collection when storage is unavailable. */
    }
    if (next.has(id)) next.delete(id);
    else next.add(id);
    current.current = next;
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      unsaved.current = false;
      setStorageError(false);
    } catch {
      unsaved.current = true;
      setStorageError(true);
    }
  }

  return { favorites, toggleFavorite, storageError };
}
