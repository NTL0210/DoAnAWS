import type { NextFunction, Request, Response } from "express";
import type { IceServerService } from "./ice-server.service.js";

export class VoiceController {
  constructor(private readonly iceServers: IceServerService) {}

  getIceServers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json(await this.iceServers.getConfig());
    } catch (error) {
      next(error);
    }
  };
}
