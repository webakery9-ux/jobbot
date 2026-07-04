import { NextResponse } from "next/server";
import {
  getJobParticipants,
  getChatMessages,
  sendChatMessage,
  resolveUserByLineId,
} from "@/lib/chat";

export async function GET(request, { params }) {
  const { jobId } = params;
  const lineUserId = new URL(request.url).searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
  }

  const user = await resolveUserByLineId(lineUserId);
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const { job, posterId, claimerId } = await getJobParticipants(jobId);
  if (user.id !== posterId && user.id !== claimerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const messages = await getChatMessages(jobId);
  return NextResponse.json({ job, messages, myUserId: user.id });
}

export async function POST(request, { params }) {
  const { jobId } = params;
  const { lineUserId, content } = await request.json();

  if (!lineUserId || !content?.trim()) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await resolveUserByLineId(lineUserId);
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const { posterId, claimerId } = await getJobParticipants(jobId);
  if (user.id !== posterId && user.id !== claimerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const message = await sendChatMessage({
    jobId,
    senderId: user.id,
    content: content.trim(),
  });
  return NextResponse.json({ message });
}
