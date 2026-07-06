import type { Request, Response, NextFunction } from "express";
import type { VoiceRecordingService } from "./voice-recording.service.js";

export class VoiceRecordingController {
  constructor(private readonly service: VoiceRecordingService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = queryString(req.query.workspaceId) || stringValue(res.locals.workspaceId);
      const channelId = queryString(req.query.channelId);
      if (!workspaceId || !channelId) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "workspaceId and channelId are required" } });
        return;
      }
      const result = await this.service.list({ workspaceId, channelId, limit: 50 });
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const workspaceId = stringValue(body.workspaceId);
      const channelId = stringValue(body.channelId);
      if (!workspaceId || !channelId) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "workspaceId and channelId are required" } });
        return;
      }
      const record = await this.service.create({
        workspaceId,
        channelId,
        title: stringValue(body.title) || undefined,
        fileName: stringValue(body.fileName) || undefined,
        mimeType: stringValue(body.mimeType) || undefined,
        sizeBytes: numberValue(body.sizeBytes),
        durationSeconds: numberValue(body.durationSeconds),
        createdBy: req.user!.userId,
      });
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  };

  createUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const input: Parameters<VoiceRecordingService["createUpload"]>[0] = {
        id: pathParam(req.params.id),
        userId: req.user!.userId,
      };
      const contentType = stringValue(body.contentType);
      const sizeBytes = numberValue(body.sizeBytes);
      if (contentType) input.contentType = contentType;
      if (sizeBytes !== undefined) input.sizeBytes = sizeBytes;
      const upload = await this.service.createUpload(input);
      res.json(upload);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const record = await this.service.markReady({
        id: pathParam(req.params.id),
        userId: req.user!.userId,
        storageKey: stringValue(body.storageKey) || undefined,
        status: stringValue(body.status) as Parameters<VoiceRecordingService["markReady"]>[0]["status"],
        sizeBytes: numberValue(body.sizeBytes),
      });
      res.json(record);
    } catch (error) {
      next(error);
    }
  };

  sendToAi = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.sendToAi({
        id: pathParam(req.params.id),
        userId: req.user!.userId,
      });
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete({ id: pathParam(req.params.id), userId: req.user!.userId });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function queryString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function pathParam(value: unknown): string {
  const id = queryString(value);
  if (!id) throw new Error("Voice recording id is required");
  return id;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
