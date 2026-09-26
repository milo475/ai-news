-- Upvote-ийн бүртгэл. upvotes багана нь энэ хүснэгтийн тооноос бодогдоно —
-- эс тэгвээс нэг хэрэглэгч хязгааргүй дарж тоолуурыг гажуудуулна.
CREATE TABLE "ToolUpvote" (
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUpvote_pkey" PRIMARY KEY ("userId", "toolId")
);

CREATE INDEX "ToolUpvote_toolId_idx" ON "ToolUpvote"("toolId");

ALTER TABLE "ToolUpvote" ADD CONSTRAINT "ToolUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolUpvote" ADD CONSTRAINT "ToolUpvote_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
