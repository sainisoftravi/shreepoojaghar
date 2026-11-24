import * as customerService from '../services/customer.service.js';
import { NotFoundError } from '../utils/AppError.js';

export const listCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const data = await customerService.listCustomers({ page, limit });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getCustomerByPhone = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerByPhone(req.params.phone);
    if (!customer) throw new NotFoundError('Customer not found');
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const data = await customerService.createCustomer(req.body);
    res.status(201).json({ success: true, message: 'Customer created successfully', data });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const data = await customerService.updateCustomer(req.params.id, req.body);
    res.json({ success: true, message: 'Customer updated successfully', data });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    await customerService.deleteCustomer(req.params.id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};
