import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/api-auth";

export const runtime = "nodejs";

// One-time migration: import localStorage JSON data into database
export async function POST(req: Request) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const results: Record<string, number> = {};

    // Migrate settings (clean old auth password from API key fields)
    if (body.settings) {
      const OLD_AUTH_PASSWORD = "jiayoubiguo2026";
      const s = { ...body.settings };
      for (const key of ["geminiApiKey", "qwenApiKey", "dashscopeApiKey"]) {
        if (s[key] === OLD_AUTH_PASSWORD) s[key] = "";
      }
      await prisma.userSettings.upsert({
        where: { userId },
        update: { data: JSON.stringify(s) },
        create: { userId, data: JSON.stringify(s) },
      });
      results.settings = 1;
    }

    // Migrate history
    if (body.history && Array.isArray(body.history)) {
      let count = 0;
      for (const pair of body.history) {
        const id = pair.question?.id || crypto.randomUUID();
        try {
          await prisma.historyEntry.create({
            data: { id, userId, data: JSON.stringify(pair) },
          });
          count++;
        } catch {
          // Skip duplicates
        }
      }
      results.history = count;
    }

    // Migrate question bank
    if (body.questionBank && Array.isArray(body.questionBank)) {
      let count = 0;
      for (const q of body.questionBank) {
        try {
          await prisma.question.create({
            data: {
              id: q.id,
              userId,
              content: q.content,
              category: q.category || null,
              tags: JSON.stringify(q.tags || []),
              source: q.source || "manual",
              sourceFile: q.sourceFile || null,
              derivedFrom: q.derivedFrom || null,
              createdAt: q.createdAt ? new Date(q.createdAt) : new Date(),
            },
          });
          count++;
        } catch {
          // Skip duplicates
        }
      }
      results.questions = count;
    }

    // Migrate exam papers
    if (body.examPapers && Array.isArray(body.examPapers)) {
      let count = 0;
      for (const paper of body.examPapers) {
        try {
          await prisma.examPaper.create({
            data: {
              id: paper.id,
              userId,
              name: paper.name,
              data: JSON.stringify(paper),
            },
          });
          count++;
        } catch {
          // Skip duplicates
        }
      }
      results.examPapers = count;
    }

    // Migrate exam sessions
    if (body.examSessions && Array.isArray(body.examSessions)) {
      let count = 0;
      for (const session of body.examSessions) {
        try {
          await prisma.examSession.create({
            data: {
              id: session.id,
              userId,
              data: JSON.stringify(session),
            },
          });
          count++;
        } catch {
          // Skip duplicates
        }
      }
      results.examSessions = count;
    }

    // Migrate mentor evaluations
    if (body.mentorEvals && typeof body.mentorEvals === "object") {
      let count = 0;
      // mentorEvals is Record<answerId, MentorEvalVersion[]>
      for (const [answerId, versions] of Object.entries(body.mentorEvals)) {
        if (!Array.isArray(versions)) continue;
        for (const v of versions as Array<{ id?: string; evaluation?: unknown; fullText?: string; createdAt?: string }>) {
          try {
            await prisma.mentorEval.create({
              data: {
                userId,
                answerId,
                data: JSON.stringify(v),
              },
            });
            count++;
          } catch {
            // Skip duplicates
          }
        }
      }
      results.mentorEvals = count;
    }

    return Response.json({ success: true, migrated: results });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
