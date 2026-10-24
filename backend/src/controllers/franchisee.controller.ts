import { Response } from 'express';
import { FranchiseeStore, IFranchiseeStore } from '../models/FranchiseeStore.model';
import { FranchiseeRequest } from '../models/FranchiseeRequest.model';
import { Member } from '../models/Member.model';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';

const sendError = (res: Response, status: number, message: string): void => {
  res.status(status).json({ status: false, message });
};

const sendServerError = (res: Response, label: string, error: any): void => {
  console.error(`[FranchiseeController.${label}] Error:`, error);
  sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || 'Franchisee store request failed');
};

const STORE_TEXT_FIELDS = ['storeId', 'storeName', 'ownerName', 'city', 'fullAddress', 'pinCode'] as const;

// Reads the editable store fields from a request body, trimming strings
const pickStoreFields = (body: any): Partial<IFranchiseeStore> => {
  const data: any = {};
  for (const field of STORE_TEXT_FIELDS) {
    if (body[field] !== undefined) data[field] = String(body[field]).trim();
  }
  if (data.storeId) data.storeId = data.storeId.toUpperCase();
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
};

const missingStoreFields = (data: any): string[] =>
  STORE_TEXT_FIELDS.filter((field) => !data[field]);

// Marks a store as bought by a member. Pending requests from that member for the store are approved.
const assignStoreToMember = async (store: any, memberId: string, adminId: string) => {
  const member = await Member.findOne({ memberId: memberId.toUpperCase() });
  if (!member) return { error: 'Member not found with this Member ID' };
  if (store.status === 'sold') return { error: 'This store has already been sold' };

  store.status = 'sold';
  store.buyerMemberId = member.memberId;
  store.buyerName = member.name;
  store.soldAt = new Date();
  store.updatedBy = adminId;
  await store.save();

  await FranchiseeRequest.updateMany(
    { store: store._id, memberId: member.memberId, status: 'pending' },
    { $set: { status: 'approved', processedBy: adminId, processedAt: new Date() } }
  );

  return { store };
};

export const FranchiseeController = {
  // ==========================================
  // MEMBER: Own store, available stores and own requests
  // ==========================================
  getMemberOverview: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const memberId = req.user?.memberId;
      if (!memberId) {
        sendError(res, HTTP_STATUS.FORBIDDEN, 'Only members can view franchisee stores');
        return;
      }

      const [ownedStores, availableStores, requests] = await Promise.all([
        FranchiseeStore.find({ buyerMemberId: memberId, status: 'sold' }).sort({ soldAt: -1 }),
        FranchiseeStore.find({ isActive: true, status: 'available' }).sort({ storeId: 1 }),
        FranchiseeRequest.find({ memberId }).sort({ createdAt: -1 }),
      ]);

      res.status(HTTP_STATUS.OK).json({
        status: true,
        data: {
          ownedStores,
          availableStores,
          requests,
        },
      });
    } catch (error: any) {
      sendServerError(res, 'getMemberOverview', error);
    }
  },

  // ==========================================
  // MEMBER: Request to buy an available store
  // ==========================================
  createRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const memberId = req.user?.memberId;
      if (!memberId) {
        sendError(res, HTTP_STATUS.FORBIDDEN, 'Only members can request a franchisee store');
        return;
      }

      const { storeId } = req.body;
      const store = await FranchiseeStore.findOne({ storeId: String(storeId || '').toUpperCase() });
      if (!store || !store.isActive) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }
      if (store.status === 'sold') {
        sendError(res, HTTP_STATUS.CONFLICT, 'This franchisee store has already been sold');
        return;
      }

      const existing = await FranchiseeRequest.findOne({
        store: store._id,
        memberId,
        status: 'pending',
      });
      if (existing) {
        sendError(res, HTTP_STATUS.CONFLICT, 'You already have a pending request for this store');
        return;
      }

      const member = await Member.findOne({ memberId });
      const request = await FranchiseeRequest.create({
        store: store._id,
        storeId: store.storeId,
        memberId,
        memberName: member?.name || '',
        status: 'pending',
      });

      res.status(HTTP_STATUS.CREATED).json({
        status: true,
        message: 'Request submitted. The admin will review it shortly.',
        data: request,
      });
    } catch (error: any) {
      sendServerError(res, 'createRequest', error);
    }
  },

  // ==========================================
  // SUPERADMIN: Stores
  // ==========================================
  adminListStores: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stores = await FranchiseeStore.find().sort({ storeId: 1 });
      res.status(HTTP_STATUS.OK).json({ status: true, data: stores });
    } catch (error: any) {
      sendServerError(res, 'adminListStores', error);
    }
  },

  adminCreateStore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const data = pickStoreFields(req.body);
      const missing = missingStoreFields(data);
      if (missing.length) {
        sendError(res, HTTP_STATUS.BAD_REQUEST, `Missing required fields: ${missing.join(', ')}`);
        return;
      }

      const exists = await FranchiseeStore.findOne({ storeId: data.storeId });
      if (exists) {
        sendError(res, HTTP_STATUS.CONFLICT, `Store ID ${data.storeId} already exists`);
        return;
      }

      const store = await FranchiseeStore.create({
        ...data,
        updatedBy: req.user?.id || 'SuperAdmin',
      });
      res.status(HTTP_STATUS.CREATED).json({ status: true, message: 'Franchisee store created', data: store });
    } catch (error: any) {
      sendServerError(res, 'adminCreateStore', error);
    }
  },

  adminUpdateStore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const store = await FranchiseeStore.findById(req.params.id);
      if (!store) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }

      const data = pickStoreFields(req.body);
      if (data.storeId && data.storeId !== store.storeId) {
        const clash = await FranchiseeStore.findOne({ storeId: data.storeId });
        if (clash) {
          sendError(res, HTTP_STATUS.CONFLICT, `Store ID ${data.storeId} already exists`);
          return;
        }
      }
      const merged: any = { ...store.toObject(), ...data };
      const missing = missingStoreFields(merged);
      if (missing.length) {
        sendError(res, HTTP_STATUS.BAD_REQUEST, `Missing required fields: ${missing.join(', ')}`);
        return;
      }

      Object.assign(store, data, { updatedBy: req.user?.id || 'SuperAdmin' });
      await store.save();

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Franchisee store updated', data: store });
    } catch (error: any) {
      sendServerError(res, 'adminUpdateStore', error);
    }
  },

  adminDeleteStore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const store = await FranchiseeStore.findById(req.params.id);
      if (!store) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }
      if (store.status === 'sold') {
        sendError(res, HTTP_STATUS.CONFLICT, 'Unassign this store from its member before deleting it');
        return;
      }

      await FranchiseeRequest.deleteMany({ store: store._id, status: 'pending' });
      await store.deleteOne();
      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Franchisee store deleted' });
    } catch (error: any) {
      sendServerError(res, 'adminDeleteStore', error);
    }
  },

  adminAssignStore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const memberId = String(req.body.memberId || '').trim();
      if (!memberId) {
        sendError(res, HTTP_STATUS.BAD_REQUEST, 'Member ID is required');
        return;
      }

      const store = await FranchiseeStore.findById(req.params.id);
      if (!store) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }

      const result = await assignStoreToMember(store, memberId, req.user?.id || 'SuperAdmin');
      if (result.error) {
        sendError(res, HTTP_STATUS.CONFLICT, result.error);
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Store assigned to member', data: result.store });
    } catch (error: any) {
      sendServerError(res, 'adminAssignStore', error);
    }
  },

  adminUnassignStore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const store = await FranchiseeStore.findById(req.params.id);
      if (!store) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }

      store.status = 'available';
      store.buyerMemberId = undefined;
      store.buyerName = undefined;
      store.soldAt = undefined;
      store.updatedBy = req.user?.id || 'SuperAdmin';
      await store.save();

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Store is available again', data: store });
    } catch (error: any) {
      sendServerError(res, 'adminUnassignStore', error);
    }
  },

  // ==========================================
  // SUPERADMIN: Search members by Member ID or name
  // ==========================================
  adminSearchMembers: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const query = String(req.query.q || '').trim();
      if (!query) {
        res.status(HTTP_STATUS.OK).json({ status: true, data: [] });
        return;
      }

      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const members = await Member.find({
        $or: [
          { memberId: { $regex: escaped, $options: 'i' } },
          { name: { $regex: escaped, $options: 'i' } },
        ],
      })
        .select('memberId name mobile city')
        .sort({ memberId: 1 })
        .limit(10);

      res.status(HTTP_STATUS.OK).json({ status: true, data: members });
    } catch (error: any) {
      sendServerError(res, 'adminSearchMembers', error);
    }
  },

  // ==========================================
  // SUPERADMIN: Member requests
  // ==========================================
  adminListRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const filter: any = {};
      if (req.query.status) filter.status = String(req.query.status);

      const requests = await FranchiseeRequest.find(filter).sort({ createdAt: -1 });
      res.status(HTTP_STATUS.OK).json({ status: true, data: requests });
    } catch (error: any) {
      sendServerError(res, 'adminListRequests', error);
    }
  },

  adminApproveRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const request = await FranchiseeRequest.findById(req.params.id);
      if (!request) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Request not found');
        return;
      }
      if (request.status !== 'pending') {
        sendError(res, HTTP_STATUS.CONFLICT, `This request is already ${request.status}`);
        return;
      }

      const store = await FranchiseeStore.findById(request.store);
      if (!store) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Franchisee store not found');
        return;
      }

      const result = await assignStoreToMember(store, request.memberId, req.user?.id || 'SuperAdmin');
      if (result.error) {
        sendError(res, HTTP_STATUS.CONFLICT, result.error);
        return;
      }

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Request approved and store assigned' });
    } catch (error: any) {
      sendServerError(res, 'adminApproveRequest', error);
    }
  },

  adminRejectRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const request = await FranchiseeRequest.findById(req.params.id);
      if (!request) {
        sendError(res, HTTP_STATUS.NOT_FOUND, 'Request not found');
        return;
      }
      if (request.status !== 'pending') {
        sendError(res, HTTP_STATUS.CONFLICT, `This request is already ${request.status}`);
        return;
      }

      request.status = 'rejected';
      request.adminNote = String(req.body.adminNote || '').trim();
      request.processedBy = req.user?.id || 'SuperAdmin';
      request.processedAt = new Date();
      await request.save();

      res.status(HTTP_STATUS.OK).json({ status: true, message: 'Request rejected' });
    } catch (error: any) {
      sendServerError(res, 'adminRejectRequest', error);
    }
  },
};

export default FranchiseeController;
