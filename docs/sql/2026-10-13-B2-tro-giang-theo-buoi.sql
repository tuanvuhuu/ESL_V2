-- B2: trợ giảng gắn theo từng buổi. Chỉ THÊM bảng mới, không xóa hay sửa dữ liệu cũ.
CREATE TABLE "SessionAssistant" (
    "sessionId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "minutes" INTEGER,

    PRIMARY KEY ("sessionId", "teacherId"),
    CONSTRAINT "SessionAssistant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionAssistant_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
