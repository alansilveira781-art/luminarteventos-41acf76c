import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
};

function buildPages(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);
  if (left > 2) pages.push("…");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < pageCount - 1) pages.push("…");
  pages.push(pageCount);
  return pages;
}

export function TablePagination({ page, pageCount, onPageChange }: Props) {
  if (pageCount <= 1) return null;
  const pages = buildPages(page, pageCount);
  const go = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount && p !== page) onPageChange(p);
  };
  return (
    <Pagination className="my-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" onClick={go(page - 1)} aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""} />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "…" ? (
            <PaginationItem key={`e${i}`}><PaginationEllipsis /></PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink href="#" isActive={p === page} onClick={go(p)}>{p}</PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext href="#" onClick={go(page + 1)} aria-disabled={page >= pageCount} className={page >= pageCount ? "pointer-events-none opacity-50" : ""} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
