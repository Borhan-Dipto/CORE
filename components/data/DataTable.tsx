"use client";

import * as React from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Menu, MenuTrigger, MenuContent, MenuCheckItem, MenuLabel } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n";

export type ColMeta = { align?: "right"; className?: string; label?: string; csv?: (row: unknown) => string | number };

export function DataTable<T>({ data, columns, t, toolbar, exportName, empty, pageSize = 20, initialSort, dense, rowId }: {
  data: T[]; columns: ColumnDef<T, unknown>[]; t: Dict; toolbar?: React.ReactNode; exportName?: string;
  empty?: React.ReactNode; pageSize?: number; initialSort?: SortingState; dense?: boolean; rowId?: (row: T) => string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const [filter, setFilter] = React.useState("");
  const [visibility, setVisibility] = React.useState<VisibilityState>({});
  const table = useReactTable({
    data, columns, state: { sorting, globalFilter: filter, columnVisibility: visibility },
    onSortingChange: setSorting, onGlobalFilterChange: setFilter, onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const exportCsv = () => {
    const cols = table.getVisibleLeafColumns().filter((c) => (c.columnDef.meta as ColMeta | undefined)?.label);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc((c.columnDef.meta as ColMeta).label)).join(",")];
    table.getFilteredRowModel().rows.forEach((r) => {
      lines.push(cols.map((c) => {
        const m = c.columnDef.meta as ColMeta;
        return esc(m.csv ? m.csv(r.original) : r.getValue(c.id));
      }).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${exportName ?? "core"}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const rows = table.getRowModel().rows;
  const pages = table.getPageCount();
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 [&>*]:min-w-0">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.search} className="h-8 pl-8" aria-label={t.search} />
        </div>
        {toolbar}
        <div className="ml-auto flex items-center gap-1">
          <Menu>
            <MenuTrigger asChild><Button variant="ghost" size="sm" aria-label={t.columns}><Columns3 /><span className="hidden sm:inline">{t.columns}</span></Button></MenuTrigger>
            <MenuContent>
              <MenuLabel>{t.columns}</MenuLabel>
              {table.getAllLeafColumns().filter((c) => c.getCanHide() && (c.columnDef.meta as ColMeta | undefined)?.label).map((c) => (
                <MenuCheckItem key={c.id} checked={c.getIsVisible()} onSelect={(e) => { e.preventDefault(); c.toggleVisibility(); }}>
                  {(c.columnDef.meta as ColMeta).label}
                </MenuCheckItem>
              ))}
            </MenuContent>
          </Menu>
          {exportName && <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!data.length}><Download /><span className="hidden sm:inline">{t.exportCsv}</span></Button>}
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {hg.headers.map((h) => {
                  const m = h.column.columnDef.meta as ColMeta | undefined;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th key={h.id} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn("h-10 px-4 text-left text-xs font-medium whitespace-nowrap text-muted-foreground", m?.align === "right" && "text-right", m?.className)}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button onClick={h.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 hover:text-foreground", m?.align === "right" && "flex-row-reverse")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id} data-id={rowId?.(r.original)} className={cn("border-b border-border last:border-0 transition-colors hover:bg-muted/40", rowId && "cursor-pointer")}>
                {r.getVisibleCells().map((c) => {
                  const m = c.column.columnDef.meta as ColMeta | undefined;
                  return <td key={c.id} className={cn("px-4 align-middle", dense ? "py-2" : "py-3", m?.align === "right" && "tabular text-right", m?.className)}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>;
                })}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="p-0">{empty ?? <p className="py-12 text-center text-sm text-muted-foreground">{t.noResults}</p>}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="tabular">{table.getFilteredRowModel().rows.length} {t.rows}</span>
          <div className="flex items-center gap-1">
            <span className="tabular mr-2">{t.page} {table.getState().pagination.pageIndex + 1} / {pages}</span>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t.prev}><ChevronLeft /></Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t.next}><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
