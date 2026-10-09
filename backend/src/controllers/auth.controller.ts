import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.model';
import { Member } from '../models/Member.model';
import { Package } from '../models/Package.model';
import { HTTP_STATUS, ROLES, BINARY_POSITION, BinaryPosition } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { WalletService } from '../services/WalletService';
import { BinaryVolume } from '../models/BinaryVolume.model';

const generateToken = (payload: { id: string; email: string; role: string; memberId?: string }): string => {
  const secret = process.env.JWT_SECRET || 'wetala_default_jwt_secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const AuthController = {
  /**
   * Public Member Registration / Signup
   * Route: POST /api/auth/register
   * Body: { name, email, phone / mobile, password, confirmPassword, sponsorId }
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        fullName,
        email,
        phone,
        mobile,
        password,
        confirmPassword,
        sponsorId,
        parentId,
        placementId,
        position,
        packageId,
        packageName,
        package: pkgInput,
      } = req.body;

      const memberName = (name || fullName || '').trim();
      const memberPhone = (phone || mobile || '').trim();
      const memberEmail = (email || '').toLowerCase().trim();

      // 1. Validation checks
      if (!memberName) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Full Name is required',
        });
        return;
      }

      if (!memberEmail) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Email address is required',
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(memberEmail)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Please provide a valid email address',
        });
        return;
      }

      if (!memberPhone) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Phone number is required',
        });
        return;
      }

      const cleanPhone = memberPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Please provide a valid phone number with at least 10 digits',
        });
        return;
      }

      if (!password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Password is required',
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

      if (confirmPassword && password !== confirmPassword) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Password and Confirm Password do not match',
        });
        return;
      }

      // 2. Uniqueness checks across Member and Admin
      const existingEmailMember = await Member.findOne({ email: memberEmail });
      const existingEmailAdmin = await Admin.findOne({ email: memberEmail });
      if (existingEmailMember || existingEmailAdmin) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Email "${memberEmail}" is already registered. Please log in instead.`,
        });
        return;
      }

      const existingPhoneMember = await Member.findOne({
        $or: [{ mobile: memberPhone }, { mobile: cleanPhone }, { phone: memberPhone }, { phone: cleanPhone }],
      });
      const existingPhoneAdmin = await Admin.findOne({
        $or: [{ phone: memberPhone }, { phone: cleanPhone }],
      });
      if (existingPhoneMember || existingPhoneAdmin) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Phone number "${memberPhone}" is already registered. Phone must be unique.`,
        });
        return;
      }

      // 3. Resolve Sponsor ID and Binary Tree Placement (Distinct relationships)
      const totalMemberCount = await Member.countDocuments();
      let resolvedSponsorId = sponsorId && sponsorId.trim() ? sponsorId.trim().toUpperCase() : 'ADMIN';
      let finalParentId = '';
      let finalPosition: BinaryPosition = BINARY_POSITION.LEFT;

      const requestedParentId = (parentId || placementId || '').trim().toUpperCase();
      const rawPosition = (position || '').trim().toUpperCase();
      const isManualPlacement = Boolean(
        requestedParentId && (rawPosition === 'LEFT' || rawPosition === 'RIGHT')
      );

      if (totalMemberCount === 0) {
        resolvedSponsorId = 'ADMIN';
        finalParentId = '';
        finalPosition = BINARY_POSITION.LEFT;
      } else {
        // Validate sponsor existence
        if (resolvedSponsorId !== 'ADMIN') {
          const sponsorExists = await Member.findOne({ memberId: resolvedSponsorId });
          if (!sponsorExists) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: `Sponsor ID "${resolvedSponsorId}" does not exist. Please enter a valid Member ID or ADMIN.`,
            });
            return;
          }
        }

        if (isManualPlacement) {
          // Manual Placement: Explicit sponsorId, parentId, and position
          const targetPos: BinaryPosition =
            rawPosition === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;

          const validation = await BinaryTreeService.validatePlacement(requestedParentId, targetPos);
          if (!validation.isValid) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({
              status: false,
              message: validation.error || `Position ${targetPos} under parent ${requestedParentId} is not available.`,
            });
            return;
          }

          finalParentId = requestedParentId;
          finalPosition = targetPos;
        } else {
          // Automatic Placement: Use BFS to find the first available slot
          const placementRoot = (resolvedSponsorId && resolvedSponsorId !== 'ADMIN') ? resolvedSponsorId : '';
          const autoPlacement = await BinaryTreeService.findNextAutoPlacement(placementRoot);
          finalParentId = autoPlacement.parentId;
          finalPosition = autoPlacement.position;
        }
      }

      // 4. Generate Next Sequential Member ID
      const newMemberId = await Member.generateNextMemberId();

      // 5. Resolve Dynamic Package from MongoDB
      const targetPkgIdentifier = packageId || packageName || pkgInput;
      let selectedPackage = null;
      if (targetPkgIdentifier) {
        selectedPackage = await Package.findOne({
          $or: [
            { packageId: targetPkgIdentifier },
            { name: targetPkgIdentifier },
            { name: new RegExp(`^${targetPkgIdentifier}$`, 'i') },
          ],
          isActive: true,
        });
      }

      if (!selectedPackage) {
        selectedPackage = await Package.findOne({ isActive: true }).sort({ packageNumber: 1, price: 1 });
      }

      const finalPackageName = selectedPackage ? selectedPackage.name : (packageName || 'Package 1');
      const finalPackageId = selectedPackage ? selectedPackage.packageId : 'PKG-1';
      const finalPackageBv = selectedPackage ? selectedPackage.bv : 1250;
      const finalPackageRp = selectedPackage ? selectedPackage.rp : 1;
      const finalDailyCapping = selectedPackage ? selectedPackage.dailyCapping : 4000;

      // 6. Create Member record (Password hashed automatically by Member schema pre-save hook)
      const newMember = await Member.create({
        memberId: newMemberId,
        name: memberName,
        email: memberEmail,
        mobile: memberPhone,
        phone: memberPhone,
        password,
        role: ROLES.MEMBER,
        sponsorId: resolvedSponsorId,
        parentId: finalParentId,
        position: finalPosition,
        binaryParentId: finalParentId,
        placementId: finalParentId,
        binaryPosition: finalPosition,
        joiningPackageId: finalPackageId,
        packageName: finalPackageName,
        packageBv: finalPackageBv,
        packageRp: finalPackageRp,
        dailyCapping: finalDailyCapping,
        status: 'pending',
        approvalStatus: 'pending',
        addedBy: resolvedSponsorId || 'ADMIN',
        isActive: false,
        personalBv: 0,
        isBinaryActive: false,
        leftBv: 0,
        rightBv: 0,
        matchedPairs: 0,
        totalIncome: 0,
        walletBalance: 0,
        joinedAt: new Date(),
        joinDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      });

      const nameParts = newMember.name.trim().split(' ');
      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: `Registration request submitted successfully for ${newMember.name}! Member ID: ${newMember.memberId}. Your account is pending Super Admin approval.`,
        memberId: newMember.memberId,
        data: {
          id: newMember._id,
          memberId: newMember.memberId,
          firstName: nameParts[0] || newMember.name,
          lastName: nameParts.slice(1).join(' ') || '',
          name: newMember.name,
          email: newMember.email,
          phone: newMember.mobile,
          mobile: newMember.mobile,
          role: newMember.role,
          sponsorId: newMember.sponsorId,
          parentId: newMember.parentId,
          position: newMember.position,
          binaryParentId: newMember.binaryParentId,
          binaryPosition: newMember.binaryPosition,
          packageName: newMember.packageName,
          joiningPackageId: newMember.joiningPackageId,
          packageBv: newMember.packageBv,
          packageRp: newMember.packageRp,
          dailyCapping: newMember.dailyCapping,
          status: newMember.status,
          approvalStatus: newMember.approvalStatus,
          personalBv: 0,
          isBinaryActive: false,
          requiredBinaryBv: 100,
          walletBalance: 0,
        },
        token: null,
      });
    } catch (error: any) {
      console.error('[AuthController.register] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Internal server error during registration',
      });
    }
  },
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

      // 1. Try finding Admin first
      const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+password');

      if (admin) {
        if (!admin.isActive) {
          res.status(HTTP_STATUS.FORBIDDEN).json({
            status: false,
            message: 'This account has been deactivated. Please contact support.',
          });
          return;
        }

        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            status: false,
            message: 'Invalid email or password',
          });
          return;
        }

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
        return;
      }

      // 2. If not admin, check Member collection by email, memberId, or mobile
      const member = await Member.findOne({
        $or: [
          { email: email.toLowerCase().trim() },
          { memberId: email.toUpperCase().trim() },
          { mobile: email.trim() },
        ],
      }).select('+password');

      if (member) {
        if (member.status === 'blocked') {
          res.status(HTTP_STATUS.FORBIDDEN).json({
            status: false,
            message: 'This account has been blocked. Please contact support.',
          });
          return;
        }

        if (member.approvalStatus === 'pending' || member.status === 'pending') {
          res.status(HTTP_STATUS.FORBIDDEN).json({
            status: false,
            message: 'Your account registration is currently pending Super Admin approval. You will be able to log in once approved.',
          });
          return;
        }

        if (member.approvalStatus === 'rejected' || member.status === 'rejected') {
          res.status(HTTP_STATUS.FORBIDDEN).json({
            status: false,
            message: `Your registration request was rejected by admin.${member.rejectionReason ? ' Reason: ' + member.rejectionReason : ''}`,
          });
          return;
        }

        const isMemberMatch = await member.comparePassword(password);
        if (!isMemberMatch) {
          res.status(HTTP_STATUS.UNAUTHORIZED).json({
            status: false,
            message: 'Invalid email or password',
          });
          return;
        }

        const token = generateToken({
          id: member._id.toString(),
          email: member.email,
          role: ROLES.MEMBER,
          memberId: member.memberId,
        });

        const nameParts = member.name.trim().split(' ');
        res.status(HTTP_STATUS.OK).json({
          status: true,
          message: 'Login successful',
          data: {
            id: member._id,
            memberId: member.memberId,
            firstName: nameParts[0] || member.name,
            lastName: nameParts.slice(1).join(' ') || '',
            name: member.name,
            email: member.email,
            mobile: member.mobile,
            phone: member.mobile,
            role: ROLES.MEMBER,
            status: member.status,
            packageName: member.packageName,
            joiningPackageId: member.joiningPackageId || (member.packageName?.toLowerCase() === 'starter' ? 'PKG-1' : (member.packageName === 'Package 1' ? 'PKG-1' : undefined)),
            packageBv: member.packageBv,
            packageRp: member.packageRp,
            dailyCapping: member.dailyCapping,
            sponsorId: member.sponsorId,
            placementId: member.placementId,
            personalBv: member.personalBv || 0,
            isBinaryActive: member.isBinaryActive || false,
            requiredBinaryBv: 100,
            walletBalance: member.walletBalance,
          },
          token,
        });
        return;
      }

      // Neither found
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        status: false,
        message: 'Invalid email or password',
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

      if (req.user.role === ROLES.MEMBER) {
        const member = await Member.findById(req.user.id);
        if (!member) {
          res.status(HTTP_STATUS.NOT_FOUND).json({
            status: false,
            message: 'Member not found',
          });
          return;
        }

        const nameParts = member.name.trim().split(' ');
        res.status(HTTP_STATUS.OK).json({
          status: true,
          data: {
            id: member._id,
            memberId: member.memberId,
            firstName: nameParts[0] || member.name,
            lastName: nameParts.slice(1).join(' ') || '',
            name: member.name,
            email: member.email,
            phone: member.mobile,
            mobile: member.mobile,
            role: ROLES.MEMBER,
            status: member.status,
            packageName: member.packageName,
            joiningPackageId: member.joiningPackageId || (member.packageName?.toLowerCase() === 'starter' ? 'PKG-1' : (member.packageName === 'Package 1' ? 'PKG-1' : undefined)),
            packageBv: member.packageBv,
            packageRp: member.packageRp,
            dailyCapping: member.dailyCapping,
            sponsorId: member.sponsorId,
            placementId: member.placementId,
            walletBalance: member.walletBalance,
            personalBv: member.personalBv || 0,
            isBinaryActive: member.isBinaryActive || false,
            requiredBinaryBv: 100,
            leftBv: member.leftBv,
            rightBv: member.rightBv,
            createdAt: member.createdAt,
          },
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
