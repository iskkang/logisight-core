import { useEffect, useState } from "react";

const STORAGE_KEY = "logisight:dark-mode";

export function useDarkMode() {
  // Always start false on server — sync from localStorage after hydration
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial =
      stored !== null
        ? stored === "true"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(initial);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark((v) => !v) };
}
