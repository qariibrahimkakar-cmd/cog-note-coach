import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NoteForgeSession } from "./noteforge/types";

const Input = z.object({
  mode: z.enum(["lecture", "conversation"]),
  format: z.enum(["mp3", "wav", "webm", "m4a", "ogg"]),
  audioBase64: z.string().min(100),
  durationSec: z.number().min(1).max(1800),
});

/**
 * Full NoteForge pipeline:
 * audio -> perception -> information events -> importance -> note decision
 *       -> compression -> organization -> teaching -> questions.
 */
export const analyzeRecording = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<NoteForgeSession> => {
    const { runSession } = await import("./noteforge/engine.server");
    return runSession(data);
  });
