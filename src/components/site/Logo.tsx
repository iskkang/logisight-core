import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-baseline font-bold tracking-tight text-white ${className}`}
      aria-label="Logisight 홈"
    >
      <span>Logi</span>
      <span style={{ color: "var(--color-cyan)" }}>sight</span>
    </Link>
  );
}