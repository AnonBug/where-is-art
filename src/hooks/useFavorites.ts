import { useEffect, useState } from "react";
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

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if ([FAVORITES_KEY, LEGACY_FAVORITES_KEY, null].includes(event.key)) {
        try {
          setFavorites(readFavorites(localStorage));
        } catch {
          /* Keep this session's collection if storage is disabled. */
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleFavorite(id: string) {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  return { favorites, toggleFavorite, storageError };
}
