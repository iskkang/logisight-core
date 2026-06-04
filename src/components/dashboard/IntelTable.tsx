import type { ReactNode } from "react";

export type ColDef<T> = {
  key: keyof T | string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type Props<T> = {
  cols: ColDef<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
};

export function IntelTable<T>({
  cols,
  rows,
  rowKey,
  onRowClick,
  emptyText = "데이터 수집 중",
}: Props<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {cols.map((col, i) => (
              <th
                key={String(col.key) + i}
                className={[
                  "py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  col.headerClassName ?? "",
                ].join(" ")}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "border-b border-border/60 transition-colors",
                  onRowClick ? "cursor-pointer hover:bg-muted/50" : "",
                ].join(" ")}
              >
                {cols.map((col, i) => (
                  <td
                    key={String(col.key) + i}
                    className={[
                      "py-2.5 pr-4 font-mono text-xs tabular-nums",
                      col.className ?? "",
                    ].join(" ")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
