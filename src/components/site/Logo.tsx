import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center ${className}`}
      aria-label="Logisight 홈"
    >
      <img src="/logisight_logo.svg" alt="Logisight" className="h-9 w-auto lg:h-10" />
    </Link>
  );
}