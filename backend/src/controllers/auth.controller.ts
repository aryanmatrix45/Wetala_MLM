import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.model';
import { HTTP_STATUS, ROLES } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const generateToken = (payload: { id: string; email: string; role: string }): string => {
  const secret = process.env.JWT_SECRET || 'wetala_default_jwt_secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const AuthController = {
  /**
   * One-time SuperAdmin Initialization
   * Route: POST /api/auth/setup-superadmin
   * Constraint: Can only be executed once per database.
   */
  async setupSuperAdmin(req: Request, res: Response): Promise<void> {
    try {
      // 1. Strict Singleton Check: has a SuperAdmin already been created?
      const alreadyInitialized = await Admin.isSuperAdminInitialized();
      if (alreadyInitialized) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: 'A SuperAdmin is already configured for this database. Multiple SuperAdmins are not permitted.',
        });
        return;
      }

      // 2. Validate request body
      const { firstName, lastName, phone, email, password } = req.body;

      if (!firstName || !lastName || !phone || !email || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'All fields are required: firstName, lastName, phone, email, and password',
        });
        return;
      }

      if (password.length < 6) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Password must be at least 6 characters long',
        });
        return;
      }

      // Check if email already in use by another role
      const existingEmail = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Email is already registered',
        });
        return;
      }

      // 3. Create the SuperAdmin
      const superAdmin = await Admin.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: ROLES.SUPERADMIN,
        isActive: true,
      });

      // 4. Generate JWT Token
      const token = generateToken({
        id: superAdmin._id.toString(),
        email: superAdmin.email,
        role: superAdmin.role,
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'SuperAdmin created successfully',
        data: {
          id: superAdmin._id,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          email: superAdmin.email,
          phone: superAdmin.phone,
          role: superAdmin.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('[AuthController.setupSuperAdmin] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Internal server error creating SuperAdmin',
      });
    }
  },

  /**
   * SuperAdmin / Admin Login
   * Route: POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Both email and password are required',
        });
        return;
      }

      // Find user and explicitly select password field
      const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');

      if (!admin) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: false,
          message: 'Invalid email or password',
        });
        return;
      }

      if (!admin.isActive) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'This account has been deactivated. Please contact support.',
        });
        return;
      }

      // Compare password
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // Generate JWT Token
      const token = generateToken({
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role,
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Login successful',
        data: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('[AuthController.login] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Internal server error during login',
      });
    }
  },

  /**
   * Check if SuperAdmin has been initialized
   * Route: GET /api/auth/superadmin-status
   */
  async getSuperAdminStatus(_req: Request, res: Response): Promise<void> {
    try {
      const isInitialized = await Admin.isSuperAdminInitialized();
      res.status(HTTP_STATUS.OK).json({
        status: true,
        isInitialized,
      });
    } catch (error: any) {
      console.error('[AuthController.getSuperAdminStatus] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to check SuperAdmin status',
      });
    }
  },

  /**
   * Get Current Authenticated Profile
   * Route: GET /api/auth/me
   */
  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: false,
          message: 'Unauthorized',
        });
        return;
      }

      const admin = await Admin.findById(req.user.id);
      if (!admin) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'User not found',
        });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          createdAt: admin.createdAt,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.getProfile] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Failed to fetch profile',
      });
    }
  },

  /**
   * Update SuperAdmin / Admin Profile Information
   * Route: PUT /api/auth/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { firstName, lastName, phone, email, currentPassword, newPassword } = req.body;

      // Find the admin including password field for verification
      const admin = await Admin.findById(req.user.id).select('+password');
      if (!admin) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: 'Admin account not found',
        });
        return;
      }

      // Check if email is being changed and if it's already taken by another account
      if (email && email.toLowerCase().trim() !== admin.email) {
        const emailTaken = await Admin.findOne({
          email: email.toLowerCase().trim(),
          _id: { $ne: admin._id },
        });
        if (emailTaken) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Email is already in use by another account',
          });
          return;
        }
        admin.email = email.toLowerCase().trim();
      }

      // Update text fields if provided
      if (firstName !== undefined) admin.firstName = firstName.trim();
      if (lastName !== undefined) admin.lastName = lastName.trim();
      if (phone !== undefined) admin.phone = phone.trim();

      // If user wants to update password
      if (newPassword) {
        if (!currentPassword) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Current password is required to set a new password',
          });
          return;
        }

        const isCurrentMatch = await admin.comparePassword(currentPassword);
        if (!isCurrentMatch) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Current password does not match',
          });
          return;
        }

        if (newPassword.length < 6) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'New password must be at least 6 characters long',
          });
          return;
        }

        admin.password = newPassword;
      }

      // Save changes (triggers password hashing if modified)
      await admin.save();

      // Generate a fresh token with updated info
      const token = generateToken({
        id: admin._id.toString(),
        email: admin.email,
        role: admin.role,
      });

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Profile updated successfully',
        data: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('[AuthController.updateProfile] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Internal server error updating profile',
      });
    }
  },
};
