import type { NextFunction, Request, Response } from "express";
import { toUserResponse } from "./user.mapper.js";
import {
  createUserSchema,
  emailQuerySchema,
  idParamsSchema,
  updateUserSchema,
} from "./user.schemas.js";
import type { UserService } from "./user.service.js";

export class UserController {
  constructor(private readonly service: UserService) {}

  /** Returns the currently authenticated user from the JWT token. */
  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      const user = await this.service.getById(req.user.userId);
      res.status(200).json(toUserResponse(user));
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.service.getAll();
      res.status(200).json({ items: users.map(toUserResponse) });
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const user = await this.service.getById(params.id);
      res.status(200).json(toUserResponse(user));
    } catch (error) {
      next(error);
    }
  };

  getByEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = emailQuerySchema.parse(req.query);
      if (!query.email) {
        res.status(400).json({ message: "Email query parameter is required" });
        return;
      }
      const user = await this.service.getByEmail(query.email);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.status(200).json(toUserResponse(user));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createUserSchema.parse(req.body);
      const user = await this.service.create(input);
      res.status(201).json(toUserResponse(user));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      const patch = updateUserSchema.parse(req.body);
      const user = await this.service.update({
        id: params.id,
        patch,
      });
      res.status(200).json(toUserResponse(user));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = idParamsSchema.parse(req.params);
      await this.service.delete(params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
