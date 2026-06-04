import { useEffect, useState } from "react";

const STORAGE_KEY = "logisight:dark-mode";

function getInitial(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark((v) => !v) };
}
