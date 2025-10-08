import { Loader } from "@mantine/core";

export default function ReaderLoading() {
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/50 bg-background/90 px-4 py-3 text-xs text-muted-foreground">
        <span>Preparing chapter…</span>
        <span>Reader interface is ready</span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-muted/20">
        <Loader size="xl" />
      </div>

      <div className="border-t border-border/50 bg-background/90 px-4 py-3 text-xs text-muted-foreground">
        Navigation controls appear once the first page is ready.
      </div>
    </div>
  );
}
