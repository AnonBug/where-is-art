import { useEffect, useState } from "react";

export function useCompact() {
  const query = "(max-width: 1023px), (pointer: coarse)";
  const [compact, setCompact] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}
