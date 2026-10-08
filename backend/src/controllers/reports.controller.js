import * as reportsService from '../services/reports.service.js';

export const getDashboard = async (req, res, next) => {
  try {
    const data = await reportsService.getDashboard();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const data = await reportsService.getDailySummary(date);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCustomRangeSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await reportsService.getCustomRangeSummary(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCustomerLTV = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const data = await reportsService.getCustomerLTV({ page, limit });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
