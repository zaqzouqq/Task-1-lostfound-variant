import Joi from 'joi';
import { Item } from '../models/Item.js';

const categories = ['electronics', 'clothing', 'documents', 'accessories', 'other'];
const statuses = ['lost', 'found', 'claimed'];

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().allow('').max(1000),
  category: Joi.string().valid(...categories),
  status: Joi.string().valid(...statuses),
  location: Joi.string().trim().allow('').max(120),
  reportedBy: Joi.string().hex().length(24)
});

const updateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120),
  description: Joi.string().trim().allow('').max(1000),
  category: Joi.string().valid(...categories),
  status: Joi.string().valid(...statuses),
  location: Joi.string().trim().allow('').max(120),
  reportedBy: Joi.string().hex().length(24)
}).min(1);

const filterSchema = Joi.object({
  status: Joi.string().valid(...statuses),
  category: Joi.string().valid(...categories)
});

function publicItem(item) {
  const reportedBy = item.reportedBy && typeof item.reportedBy === 'object'
    ? {
        id: item.reportedBy._id.toString(),
        name: item.reportedBy.name,
        email: item.reportedBy.email
      }
    : item.reportedBy;

  return {
    id: item._id.toString(),
    title: item.title,
    description: item.description,
    category: item.category,
    status: item.status,
    location: item.location,
    reportedBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function isDuplicateItemError(err) {
  return err?.code === 11000;
}

// GET /api/items
export async function getAllItems(req, res, next) {
  try {
    const { value, error } = filterSchema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const items = await Item.find(value)
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ items: items.map(publicItem) });
  } catch (err) { next(err); }
}

// GET /api/items/:id
export async function getItem(req, res, next) {
  try {
    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item: publicItem(item) });
  } catch (err) { next(err); }
}

// POST /api/items
export async function createItem(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const item = await Item.create(value);
    await item.populate('reportedBy', 'name email');
    res.status(201).json({ item: publicItem(item) });
  } catch (err) {
    if (isDuplicateItemError(err)) {
      return res.status(409).json({ message: 'An item with this title already exists at this location' });
    }
    next(err);
  }
}

// PATCH /api/items/:id
export async function updateItem(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate('reportedBy', 'name email');

    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item: publicItem(item) });
  } catch (err) {
    if (isDuplicateItemError(err)) {
      return res.status(409).json({ message: 'An item with this title already exists at this location' });
    }
    next(err);
  }
}

// DELETE /api/items/:id
export async function deleteItem(req, res, next) {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
