import { Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { AuthenticatedRequest } from '../middlewares/auth';
import { CompanyEarningService } from '../services/CompanyEarningService';
import { actorFromRequest, handleError, requireAdminPassword, requireOperatorName } from './bvWallet.controller';

/** Super Admin only; the router enforces the role. */
const withErrors =
  (context: string, handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      handleError(res, error, `CompanyEarnings.${context}`);
    }
  };

export const CompanyEarningsController = {
  /** GET /api/company-earnings/summary */
  getSummary: withErrors('getSummary', async (_req, res) => {
    const data = await CompanyEarningService.summary();
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** GET /api/company-earnings?type&memberId&search&from&to&page&limit  (dates are IST 'YYYY-MM-DD') */
  list: withErrors('list', async (req, res) => {
    const { type, memberId, search, from, to, page, limit } = req.query;
    const data = await CompanyEarningService.list({ type, memberId, search, from, to, page, limit });
    res.status(HTTP_STATUS.OK).json({ status: true, ...data, data: data.items, items: undefined });
  }),

  /** GET /api/company-earnings/export?type&memberId&search&from&to  (CSV download) */
  exportCsv: withErrors('exportCsv', async (req, res) => {
    const { type, memberId, search, from, to } = req.query;
    const csv = await CompanyEarningService.exportCsv({ type, memberId, search, from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="company-earnings-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(HTTP_STATUS.OK).send(csv);
  }),

  /** GET /api/company-earnings/rate */
  getRate: withErrors('getRate', async (_req, res) => {
    const rate = await CompanyEarningService.getCurrentRate();
    res.status(HTTP_STATUS.OK).json({ status: true, data: CompanyEarningService.rateToPublic(rate) });
  }),

  /** GET /api/company-earnings/rate/history */
  getRateHistory: withErrors('getRateHistory', async (_req, res) => {
    const data = await CompanyEarningService.rateHistory();
    res.status(HTTP_STATUS.OK).json({ status: true, data });
  }),

  /** PUT /api/company-earnings/rate  { rate, note?, operatorName, password } */
  setRate: withErrors('setRate', async (req, res) => {
    const operatorName = requireOperatorName(req.body?.operatorName);
    await requireAdminPassword(req);
    const rate = await CompanyEarningService.setRate({
      rate: req.body?.rate,
      note: req.body?.note,
      actor: actorFromRequest(req, operatorName),
    });
    const data = CompanyEarningService.rateToPublic(rate);
    res.status(HTTP_STATUS.OK).json({
      status: true,
      message: `BV rate set to ₹${data!.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })} per BV. New BV sales use this rate.`,
      data,
    });
  }),
};

export default CompanyEarningsController;
