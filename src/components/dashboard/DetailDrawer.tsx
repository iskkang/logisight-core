import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
};

export function DetailDrawer({ open, onClose, title, children }: Props) {
  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="fixed inset-y-0 right-0 left-auto h-full w-full max-w-md rounded-none border-l border-border bg-card p-0">
        <DrawerHeader className="flex items-center justify-between border-b border-border px-5 py-4">
          <DrawerTitle className="text-sm font-semibold">{title}</DrawerTitle>
          <DrawerClose asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
