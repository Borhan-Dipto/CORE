"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const overlay = "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in";

// ---------- Dialog ----------
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, title, description, ...props }:
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 grid w-full gap-5 border border-border bg-popover p-6 text-popover-foreground shadow-pop outline-none data-[state=open]:animate-in",
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
          className,
        )}
        {...props}
      >
        <div className="grid gap-1 pr-8">
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          {description ? <DialogPrimitive.Description className="text-[13px] text-muted-foreground">{description}</DialogPrimitive.Description>
            : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
        </div>
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ---------- Sheet (mobile drawer) ----------
export function SheetContent({ className, children, side = "left", label }:
  { className?: string; children: React.ReactNode; side?: "left" | "right"; label: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn("fixed inset-y-0 z-50 flex w-[85vw] max-w-72 flex-col bg-sidebar shadow-pop outline-none data-[state=open]:animate-in", side === "left" ? "left-0 border-r" : "right-0 border-l", className)}
      >
        <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{label}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ---------- Confirm dialog ----------
export function ConfirmDialog({ trigger, title, description, confirmLabel, cancelLabel, destructive, onConfirm, children }: {
  trigger: React.ReactNode; title: string; description?: string; confirmLabel: string; cancelLabel: string;
  destructive?: boolean; onConfirm: () => void | Promise<void>; children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  return (
    <AlertPrimitive.Root open={open} onOpenChange={setOpen}>
      <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-popover p-6 shadow-pop data-[state=open]:animate-in">
          <AlertPrimitive.Title className="text-base font-semibold">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description className={cn("text-[13px] text-muted-foreground", !description && "sr-only")}>{description ?? title}</AlertPrimitive.Description>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>{cancelLabel}</AlertPrimitive.Cancel>
            <button
              className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
              disabled={busy}
              onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}

// ---------- Dropdown menu ----------
export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuGroup = MenuPrimitive.Group;
export function MenuContent({ className, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content align={align} sideOffset={6}
        className={cn("z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-pop data-[state=open]:animate-in", className)} {...props} />
    </MenuPrimitive.Portal>
  );
}
export function MenuItem({ className, inset, ...props }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { inset?: boolean }) {
  return <MenuPrimitive.Item className={cn("relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground", inset && "pl-8", className)} {...props} />;
}
export function MenuCheckItem({ checked, children, ...props }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { checked?: boolean }) {
  return (
    <MenuItem {...props}>
      <span className="flex size-4 items-center justify-center">{checked && <Check className="!text-foreground" />}</span>
      {children}
    </MenuItem>
  );
}
export function MenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}
export function MenuSeparator() { return <MenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />; }

// ---------- Tooltip ----------
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground shadow-pop data-[state=delayed-open]:animate-in">
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
