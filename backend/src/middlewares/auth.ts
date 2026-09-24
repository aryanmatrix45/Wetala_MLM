import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS, ROLES } from '../config/constants';

export interface AuthUserPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: false,
      message: 'Access token is required. Format: Bearer <token>',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'wetala_default_jwt_secret';

  try {
    const decoded = jwt.verify(token, secret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: false,
      message: 'Invalid or expired token',
    });
  }
};

export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== ROLES.SUPERADMIN) {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      status: false,
      message: 'Forbidden: SuperAdmin privilege required',
    });
    return;
  }
  next();
};
