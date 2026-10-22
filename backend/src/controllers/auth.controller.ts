import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.model';
import { Member } from '../models/Member.model';
import { Package } from '../models/Package.model';
import { Purchase } from '../models/Purchase.model';
import { HTTP_STATUS, ROLES, BINARY_POSITION, BinaryPosition, PURCHASE_TYPE, PURCHASE_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { BinaryTreeService } from '../services/tree/BinaryTreeService';
import { WalletService } from '../services/WalletService';
import { BVService } from '../services/BVService';
import { BinaryVolume } from '../models/BinaryVolume.model';
import { referralBlockReason } from '../utils/binaryEligibility';

const generateToken = (payload: { id: string; email: string; role: string; memberId?: string }): string => {
  const secret = process.env.JWT_SECRET || 'wetala_default_jwt_secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

/**
 * Validates the optional nominee fields (shared by registration and the member profile).
 * Empty values are allowed and clear the field.
 */
const parseNominee = (
  body: any
): { nomineeName: string; nomineePhone: string; nomineeAge: number | null } | { error: string } => {
  const nomineeName = String(body?.nomineeName ?? '').trim().replace(/\s+/g, ' ');
  const nomineePhone = String(body?.nomineePhone ?? '').trim();
  const rawAge = String(body?.nomineeAge ?? '').trim();

  if (nomineeName && !/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(nomineeName)) {
    return { error: 'Nominee Name may contain letters, spaces, dots, hyphens and apostrophes only.' };
  }
  if (nomineePhone && !/^\d{10}$/.test(nomineePhone)) {
    return { error: 'Nominee Phone Number must contain exactly 10 digits.' };
  }
  let nomineeAge: number | null = null;
  if (rawAge) {
    nomineeAge = Number(rawAge);
    if (!/^\d{1,3}$/.test(rawAge) || nomineeAge < 1 || nomineeAge > 120) {
      return { error: 'Nominee Age must be a whole number between 1 and 120.' };
    }
  }
  return { nomineeName, nomineePhone, nomineeAge };
};

export const AuthController = {
  /**
   * Public Member Registration / Signup
   * Route: POST /api/auth/register
   * Body: { name, email, phone / mobile, password, confirmPassword, sponsorId, position,
   *         nomineeName?, nomineePhone?, nomineeAge? }
   * KYC (bank, PAN, Aadhaar, documents) is collected separately after login via /api/kyc/me.
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        fullName,
        email,
        phone,
        mobile,
        countryCode,
        password,
        confirmPassword,
        sponsorId,
        parentId,
        placementId,
        position,
        termsAccepted,
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
          message: 'Mobile number is required',
        });
        return;
      }

      // 1. Mobile Number Validation: Must contain exactly 10 numeric digits, no non-numeric characters
      const cleanPhone = String(memberPhone).trim();
      let strippedPhone = cleanPhone;
      if (strippedPhone.startsWith('+91')) {
        strippedPhone = strippedPhone.slice(3).trim();
      } else if (strippedPhone.startsWith('+')) {
        strippedPhone = strippedPhone.replace(/^\+\d{1,4}\s*/, '').trim();
      }

      // Reject non-numeric characters
      if (!/^\d+$/.test(strippedPhone)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Mobile number must contain digits only. Letters and special characters are not allowed.',
        });
        return;
      }

      // Reject invalid lengths
      if (strippedPhone.length !== 10) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Mobile number must contain exactly 10 digits.',
        });
        return;
      }

      const validMobile = strippedPhone;
      let resolvedCountryCode = (countryCode || '+91').trim();
      if (!/^\+\d{1,4}$/.test(resolvedCountryCode)) {
        resolvedCountryCode = '+91';
      }

      // 2. Optional nominee details
      const nominee = parseNominee(req.body);
      if ('error' in nominee) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: nominee.error });
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

      if (!confirmPassword) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Confirm Password is required',
        });
        return;
      }

      if (password !== confirmPassword) {
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
        $or: [{ mobile: validMobile }, { phone: validMobile }],
      });
      const existingPhoneAdmin = await Admin.findOne({
        $or: [{ phone: validMobile }],
      });
      if (existingPhoneMember || existingPhoneAdmin) {
        res.status(HTTP_STATUS.CONFLICT).json({
          status: false,
          message: `Phone number "${validMobile}" is already registered. Phone must be unique.`,
        });
        return;
      }

      // 3. Resolve Sponsor ID and Binary Tree Placement (Distinct relationships)
      const totalMemberCount = await Member.countDocuments();
      let resolvedSponsorId = '';
      let finalParentId = '';
      let finalPosition: BinaryPosition = BINARY_POSITION.LEFT;

      const rawPosition = (position || '').trim().toUpperCase();
      const targetPos: BinaryPosition =
        rawPosition === 'RIGHT' ? BINARY_POSITION.RIGHT : BINARY_POSITION.LEFT;

      if (totalMemberCount === 0) {
        // Very first member in the system: Root Node of binary tree
        // Has NO sponsor ID (not even ADMIN) and NO parent ID
        resolvedSponsorId = '';
        finalParentId = '';
        finalPosition = BINARY_POSITION.LEFT;
      } else {
        // All subsequent members strictly require an existing Member ID as sponsor
        const rawSponsor = (sponsorId || '').trim().toUpperCase();
        if (!rawSponsor) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: 'Sponsor ID is mandatory. Please provide a valid registered Member ID.',
          });
          return;
        }

        // If sponsor is specified as ADMIN, SUPERADMIN, or COMPANY, auto-resolve to Company Root Member (MEM0001)
        let sponsorToLookup = rawSponsor;
        if (rawSponsor === 'ADMIN' || rawSponsor === 'SUPERADMIN' || rawSponsor === 'COMPANY') {
          const rootMember = await Member.findOne().sort({ createdAt: 1 });
          sponsorToLookup = rootMember ? rootMember.memberId : 'MEM0001';
        }

        const sponsorExists = await Member.findOne({ memberId: sponsorToLookup });
        if (!sponsorExists) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({
            status: false,
            message: `Sponsor ID "${rawSponsor}" does not exist in our system. Please enter a valid Member ID.`,
          });
          return;
        }

        // Only binary-active members can refer; the root (Super Admin's link) always can
        const blockReason = referralBlockReason(sponsorExists);
        if (blockReason) {
          res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, code: 'SPONSOR_NOT_ACTIVE', message: blockReason });
          return;
        }

        resolvedSponsorId = sponsorExists.memberId;

        // Binary Tree Placement is DECOUPLED from registration:
        // New member is assigned preferredLeg, but parentId remains empty ('')
        // until binary activation (>= 100 BV accumulated).
        finalParentId = '';
        finalPosition = targetPos;
      }

      // 4. Generate Next Sequential Member ID
      const newMemberId = await Member.generateNextMemberId();

      // 5. Resolve Dynamic Package from MongoDB (only if explicitly specified)
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

      const isRoot = totalMemberCount === 0;

      // Only Root member is granted an immediate active package without payment verification.
      // All subsequent members strictly require payment verification and admin marking as PAID.
      const finalPackageName = (isRoot && selectedPackage) ? selectedPackage.name : null;
      const finalPackageId = (isRoot && selectedPackage) ? selectedPackage.packageId : null;
      const finalPackageBv = (isRoot && selectedPackage) ? selectedPackage.bv : 0;
      const finalPackageRp = (isRoot && selectedPackage) ? selectedPackage.rp : 0;
      const finalDailyCapping = (isRoot && selectedPackage) ? (selectedPackage.dailyCapping || 0) : 0;

      // 6. Create Member record (Password hashed automatically by Member schema pre-save hook)
      // All registrations are immediately active & approved for direct instant login!
      const newMember = await Member.create({
        memberId: newMemberId,
        name: memberName,
        email: memberEmail,
        countryCode: resolvedCountryCode,
        mobile: validMobile,
        phone: validMobile,
        nomineeName: nominee.nomineeName,
        nomineePhone: nominee.nomineePhone,
        nomineeAge: nominee.nomineeAge,
        termsAccepted: termsAccepted !== false,
        password,
        role: ROLES.MEMBER,
        sponsorId: resolvedSponsorId,
        parentId: finalParentId,
        position: finalPosition,
        preferredLeg: targetPos,
        binaryParentId: finalParentId,
        placementId: finalParentId,
        binaryPosition: finalPosition,
        joiningPackageId: finalPackageId,
        packageName: finalPackageName,
        packageBv: finalPackageBv,
        packageRp: finalPackageRp,
        dailyCapping: finalDailyCapping,
        status: 'active',
        approvalStatus: 'approved',
        addedBy: isRoot ? 'ADMIN' : (resolvedSponsorId || 'ADMIN'),
        isActive: true,
        personalBv: isRoot ? (finalPackageBv || 1250) : 0,
        isBinaryActive: isRoot,
        leftBv: 0,
        rightBv: 0,
        matchedPairs: 0,
        totalIncome: 0,
        walletBalance: 0,
        joinedAt: new Date(),
        joinDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      });

      // Initialize Wallet and Binary Volume accounting for immediate dashboard usability
      await WalletService.getOrCreateWallet(newMember.memberId, newMember._id.toString()).catch(() => null);
      await BVService.getOrCreateBinaryVolume(newMember.memberId, newMember._id.toString()).catch(() => null);

      // If a package was selected during registration by a non-root member,
      // create a PENDING Purchase order so Admin can verify payment before activating it
      if (!isRoot && selectedPackage) {
        const purchaseId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const tempTxnId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const authPrice = Number(selectedPackage.price);
        const authBv = Number(selectedPackage.bv);

        await Purchase.create({
          purchaseId,
          userId: newMember._id.toString(),
          memberId: newMember.memberId,
          memberName: newMember.name,
          memberMobile: newMember.mobile,
          memberEmail: newMember.email,
          type: PURCHASE_TYPE.JOINING,
          items: [
            {
              itemId: selectedPackage.packageId,
              itemType: 'PACKAGE',
              name: selectedPackage.name,
              quantity: 1,
              unitPrice: authPrice,
              price: authPrice,
              unitPriceInPaise: selectedPackage.priceInPaise || Math.round(authPrice * 100),
              unitBV: authBv,
              businessVolume: authBv,
              totalPrice: authPrice,
              totalPriceInPaise: Math.round(authPrice * 100),
              totalBV: authBv,
            },
          ],
          totalAmount: authPrice,
          totalAmountInPaise: Math.round(authPrice * 100),
          totalBV: authBv,
          status: PURCHASE_STATUS.PENDING,
          paymentStatus: 'PENDING',
          approvalStage: 'REQUESTED',
          transactionId: tempTxnId,
          notes: `Joining Package (${selectedPackage.name}) requested at registration by ${newMember.name} (${newMember.memberId}). Requires Super Admin payment verification before crediting.`,
        }).catch((err) => console.warn('[AuthController.register] Notice: Pending package request creation notice:', err));
      }

      // Root member auto-placement
      if (isRoot) {
        await BinaryTreeService.placeMemberInBinaryTree(newMember.memberId);
      }

      const nameParts = newMember.name.trim().split(' ');
      const successMessage = totalMemberCount === 0
        ? `🎉 Root Member setup successful for ${newMember.name}! Member ID: ${newMember.memberId}. Account is active as the Root of the tree.`
        : `🎉 Welcome to the Panchveda Wellness Family, ${newMember.name}! Member ID: ${newMember.memberId}. You can log in immediately with your Email & Password. Your binary tree position will activate once you accumulate at least 100 BV.`;

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: successMessage,
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
      const cleanEmail = (req.body.email || req.body.identifier || '').trim().toLowerCase();
      const password = req.body.password;

      if (!cleanEmail || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Both Email ID and password are required',
        });
        return;
      }

      // Strictly validate that user is signing in with an Email ID
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          status: false,
          message: 'Please provide a valid Email ID (e.g. user@example.com). Login is strictly restricted to Email ID and password.',
        });
        return;
      }

      // 1. Try finding Admin first strictly by Email ID
      const admin = await Admin.findOne({ email: cleanEmail }).select('+password');

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

      // 2. If not admin, check Member collection strictly by Email ID
      const member = await Member.findOne({
        email: cleanEmail,
      }).select('+password');

      if (member) {
        if (member.status === 'blocked') {
          res.status(HTTP_STATUS.FORBIDDEN).json({
            status: false,
            message: 'This account has been blocked. Please contact support.',
          });
          return;
        }

        // Legacy check: If any existing member is still marked pending, auto-activate them now
        if (member.approvalStatus === 'pending' || member.status === 'pending') {
          member.approvalStatus = 'approved';
          member.status = 'active';
          member.isActive = true;
          await member.save();
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
            joiningPackageId: member.joiningPackageId || undefined,
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
            joiningPackageId: member.joiningPackageId || undefined,
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
            countryCode: member.countryCode || '+91',
            gender: member.gender || '',
            dob: member.dob || '',
            address: member.address || '',
            city: member.city || '',
            state: member.state || '',
            pincode: member.pincode || '',
            panNumber: member.panNumber || '',
            aadhaarNumber: member.aadhaarNumber
              ? (member.aadhaarNumber.replace(/\D/g, '').length >= 4
                  ? `•••• •••• ${member.aadhaarNumber.replace(/\D/g, '').slice(-4)}`
                  : '••••')
              : '',
            nomineeName: member.nomineeName || '',
            nomineePhone: member.nomineePhone || '',
            nomineeAge: member.nomineeAge ?? null,
            kycStatus: member.kyc?.status || 'not_submitted',
            rank: member.rank,
            joinDate: member.joinDate,
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

  /**
   * Member: update own nominee details. Only the nominee fields are accepted; email, phone and
   * every other profile field stay unchanged.
   * Route: PATCH /api/auth/profile/nominee
   * Body: { nomineeName, nomineePhone, nomineeAge } (empty values clear a field)
   */
  async updateNominee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user?.role !== ROLES.MEMBER) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          status: false,
          message: 'Nominee details are available to member accounts only.',
        });
        return;
      }

      const nominee = parseNominee(req.body);
      if ('error' in nominee) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: nominee.error });
        return;
      }

      const member = await Member.findByIdAndUpdate(
        req.user.id,
        { $set: nominee },
        { new: true, runValidators: true }
      );
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ status: false, message: 'Member not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json({
        status: true,
        message: 'Nominee details updated successfully.',
        data: {
          nomineeName: member.nomineeName || '',
          nomineePhone: member.nomineePhone || '',
          nomineeAge: member.nomineeAge ?? null,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.updateNominee] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: 'Failed to update nominee details.',
      });
    }
  },

  /**
   * Public Sponsor Lookup (for referral link & pre-registration)
   * GET /api/auth/sponsor-lookup/:sponsorId
   */
  async sponsorLookup(req: Request, res: Response): Promise<void> {
    try {
      const rawId = (req.params.sponsorId || (req.query.sponsorId as string) || (req.query.ref as string) || '').trim().toUpperCase();
      if (!rawId) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ status: false, message: 'Sponsor ID is required.' });
        return;
      }

      // If looking up ADMIN or SUPERADMIN or COMPANY, auto-resolve to Company Root Member (MEM0001)
      let targetId = rawId;
      if (rawId === 'ADMIN' || rawId === 'SUPERADMIN' || rawId === 'COMPANY') {
        const rootMember = await Member.findOne().sort({ createdAt: 1 });
        targetId = rootMember ? rootMember.memberId : 'MEM0001';
      }

      const member = await Member.findOne({ memberId: targetId }).select(
        'memberId name rank status packageName isActive isBinaryActive personalBv parentId sponsorId'
      );
      if (!member) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          status: false,
          message: `Sponsor ID "${rawId}" does not exist in our system. Please enter a valid Member ID.`,
        });
        return;
      }

      const referralBlockedReason = referralBlockReason(member);
      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId: member.memberId,
          name: member.name,
          rank: member.rank || 'Distributor',
          status: member.status,
          packageName: member.packageName || 'Basic',
          isActive: member.isActive,
          isRoot: !member.sponsorId,
          canRefer: !referralBlockedReason,
          ...(referralBlockedReason ? { referralBlockedReason } : {}),
        },
      });
    } catch (error: any) {
      console.error('[AuthController.sponsorLookup] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Error looking up sponsor',
      });
    }
  },

  /**
   * Public Root Sponsor Lookup (For Super Admin referral center)
   * GET /api/auth/root-sponsor
   */
  async getRootSponsor(_req: Request, res: Response): Promise<void> {
    try {
      const rootMember = await Member.findOne().sort({ createdAt: 1 }).select('memberId name rank status packageName isActive');
      const rootId = rootMember ? rootMember.memberId : 'MEM0001';
      const rootName = rootMember?.name || '';

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          memberId: rootId,
          name: rootName,
          rank: rootMember?.rank || 'Distributor',
          status: rootMember?.status || 'active',
          packageName: rootMember?.packageName || '',
          isActive: true,
          isRoot: true,
        },
      });
    } catch (error: any) {
      console.error('[AuthController.getRootSponsor] Error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: false,
        message: error.message || 'Error fetching root sponsor',
      });
    }
  },
};
