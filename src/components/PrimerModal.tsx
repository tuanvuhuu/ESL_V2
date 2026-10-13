"use client";

import { Button as PrimerButton, IconButton } from "@primer/react";
import { XIcon } from "@primer/octicons-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type PrimerModalProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  onOk?: () => void | Promise<void>;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  okButtonType?: "primary" | "danger" | "default";
  width?: "small" | "medium" | "large" | "xlarge" | string | number;
  footer?: ReactNode | false;
  children: ReactNode;
};

/**
 * PrimerModal: Drawer / Sidebar bên phải chuẩn GitHub Primer
 * - Trượt từ cạnh phải màn hình (Right Slide-over Drawer)
 * - Nền mờ (backdrop) có thể click để đóng
 * - Nút đóng X sắc nét, hỗ trợ phím Escape
 * - Tự động khóa cuộn trang nền khi mở
 * - Header, Body cuộn tự nhiên và Footer ghim cố định ở đáy
 */
export function PrimerModal({
  open,
  title,
  subtitle,
  onClose,
  onOk,
  okText = "Lưu",
  cancelText = "Hủy",
  confirmLoading = false,
  okButtonType = "primary",
  width = "large",
  footer,
  children,
}: PrimerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  let drawerWidth = "min(720px, 92vw)";
  if (width === "small") drawerWidth = "min(420px, 92vw)";
  else if (width === "medium") drawerWidth = "min(560px, 92vw)";
  else if (width === "large") drawerWidth = "min(720px, 92vw)";
  else if (width === "xlarge") drawerWidth = "min(880px, 95vw)";
  else if (typeof width === "number") drawerWidth = `min(${width}px, 95vw)`;
  else if (typeof width === "string") {
    drawerWidth = width.includes("min") ? width : `min(${width}, 95vw)`;
  }

  const defaultFooter =
    footer === false ? undefined : footer ? (
      <div className="primer-drawer-footer">{footer}</div>
    ) : (
      <div className="primer-drawer-footer">
        <PrimerButton size="medium" onClick={onClose} disabled={confirmLoading}>
          {cancelText}
        </PrimerButton>
        {onOk && (
          <PrimerButton
            variant={okButtonType}
            size="medium"
            onClick={onOk}
            loading={confirmLoading}
          >
            {okText}
          </PrimerButton>
        )}
      </div>
    );

  return createPortal(
    <div
      className="primer-drawer-root"
      data-color-mode="light"
      data-light-theme="light"
      aria-modal="true"
      role="dialog"
    >
      <div className="primer-drawer-backdrop" onClick={onClose} />
      <div className="primer-drawer" style={{ width: drawerWidth }}>
        <div className="primer-drawer-header">
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <h2 className="primer-drawer-title">{title}</h2>
            {subtitle && <p className="primer-drawer-subtitle">{subtitle}</p>}
          </div>
          <IconButton
            icon={XIcon}
            variant="invisible"
            size="small"
            aria-label="Đóng"
            onClick={onClose}
            className="primer-drawer-close"
          />
        </div>
        <div className="primer-drawer-body">{children}</div>
        {defaultFooter}
      </div>
    </div>,
    document.body
  );
}

// Alias PrimerDrawer
export const PrimerDrawer = PrimerModal;
