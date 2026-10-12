"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircleFillIcon, AlertFillIcon, InfoIcon } from "@primer/octicons-react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: number;
  type: ToastType;
  content: ReactNode;
  duration?: number;
};

type ToastListener = (toasts: ToastItem[]) => void;

let listeners: ToastListener[] = [];
let toasts: ToastItem[] = [];
let nextId = 1;

function notify() {
  for (const listener of listeners) {
    listener([...toasts]);
  }
}

export const message = {
  success: (content: ReactNode, duration = 3) => addToast("success", content, duration),
  error: (content: ReactNode, duration = 4) => addToast("error", content, duration),
  info: (content: ReactNode, duration = 3) => addToast("info", content, duration),
  warning: (content: ReactNode, duration = 3.5) => addToast("warning", content, duration),
};

export const toast = message;

/** Tương thích với `const { message } = App.useApp()` từ Ant Design */
export const App = {
  useApp: () => ({ message }),
};

function addToast(type: ToastType, content: ReactNode, duration: number) {
  const id = nextId++;
  const item: ToastItem = { id, type, content, duration };
  toasts = [...toasts, item];
  notify();

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration * 1000);
  }
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {items.map((it) => {
        const icon =
          it.type === "success" ? (
            <CheckCircleFillIcon size={16} fill="#1A7F37" />
          ) : it.type === "error" ? (
            <AlertFillIcon size={16} fill="#CF222E" />
          ) : (
            <InfoIcon size={16} fill="#0969DA" />
          );

        const borderColor =
          it.type === "success" ? "#4AC26B" : it.type === "error" ? "#FF8182" : "#54AEFF";

        return (
          <div
            key={it.id}
            style={{
              pointerEvents: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "#FFFFFF",
              color: "#1F2328",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(140, 149, 159, 0.2), 0 1px 3px rgba(31, 35, 40, 0.12)",
              border: `1px solid ${borderColor}`,
              fontSize: 13,
              fontWeight: 500,
              minWidth: 260,
              maxWidth: 480,
              animation: "primerToastIn 0.15s ease-out",
            }}
          >
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, wordBreak: "break-word" }}>{it.content}</span>
          </div>
        );
      })}
    </div>
  );
}
