"use client";

import type { Center, ScheduleSession } from "@/client/types";
import { toMinutes } from "@/lib/dates";
import { tint } from "@/lib/colors";

const START_HOUR = 7;
const END_HOUR = 22;
const SPAN = (END_HOUR - START_HOUR) * 60;

/** Lưới phòng × giờ trong một ngày (DESIGN 6.4) — thành phần tự xây. */
export function RoomDayGrid({
  centers,
  sessions,
  onOpen,
}: {
  centers: Center[];
  sessions: ScheduleSession[];
  onOpen: (s: ScheduleSession) => void;
}) {
  // Vị trí theo % chiều rộng để thấy trọn ngày; cuộn ngang khi màn hình hẹp.
  const pct = (minutes: number) => `${(minutes / SPAN) * 100}%`;
  const x = (t: string) => toMinutes(t) - START_HOUR * 60;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="room-grid">
      <div className="room-grid-inner" style={{ minWidth: 960 }}>
        <div className="room-grid-row" style={{ minHeight: 24 }}>
          <div className="room-grid-label" />
          <div className="room-grid-track">
            {hours.map((h) => (
              <span key={h} className="room-grid-hour-label" style={{ left: pct((h - START_HOUR) * 60), transform: h === START_HOUR ? "none" : undefined }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>
        {centers.map((center) => (
          <div key={center.id}>
            {centers.length > 1 && (
              <div style={{ padding: "6px 8px", fontWeight: 600, color: center.color, background: tint(center.color, 6) }}>{center.name}</div>
            )}
            {center.rooms
              .filter((r) => r.active)
              .map((room) => (
                <div key={room.id} className="room-grid-row">
                  <div className="room-grid-label">
                    {room.name}
                    <div className="sub">{room.capacity} chỗ</div>
                  </div>
                  <div className="room-grid-track">
                    {hours.map((h) => (
                      <div key={h} className="room-grid-hour" style={{ left: pct((h - START_HOUR) * 60) }} />
                    ))}
                    {sessions
                      .filter((s) => s.roomId === room.id)
                      .map((s) => {
                        const sub = s.teacherId !== s.class.teacherId;
                        return (
                          <div
                            key={s.id}
                            className={`session-card${s.status === "CANCELLED" ? " cancelled" : ""}${sub ? " substitute" : ""}`}
                            style={{
                              left: pct(x(s.startTime)),
                              width: `calc(${pct(x(s.endTime) - x(s.startTime))} - 2px)`,
                              borderLeftColor: s.class.center.color,
                            }}
                            title={`${s.class.code} · ${s.class.name}\n${s.startTime}–${s.endTime}\n${s.teacher.displayName}`}
                            onClick={() => onOpen(s)}
                          >
                            <b>{s.class.code}</b> {s.startTime}–{s.endTime}
                            <div>
                              {s.teacher.displayName}
                              {sub ? " · dạy thay" : ""}
                              {s.class.assistants.length ? ` + ${s.class.assistants.map((a) => a.teacher.displayName).join(", ")}` : ""}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
