import Joi from 'joi';

export class Post {
  constructor({
    id = null,
    slug = '',
    title = '',
    content = '',
    tags = [],
    author = 'admin',
    views = 0,
    published = true,
    created_at = new Date(),
    updated_at = new Date(),
    category_id = null,
    category = null,
  } = {}) {
    this.id = id;
    this.slug = slug;
    this.title = title;
    this.content = content;
    this.tags = Array.isArray(tags) ? tags : [];
    this.author = author;
    this.views = views;
    this.published = !!published;
    this.created_at = new Date(created_at);
    this.updated_at = new Date(updated_at);
    this.category_id = category_id;
    this.category = category;
  }

  static validate(payload = {}) {
    return postSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const postSchema = Joi.object({
  id: Joi.number().integer().optional(),
  slug: Joi.string().min(3).max(50).pattern(/^[a-z0-9-]+$/).required(),
  title: Joi.string().min(3).max(255).required(),
  content: Joi.string().required(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  author: Joi.string().max(100).optional(),
  views: Joi.number().integer().min(0).optional(),
  published: Joi.alternatives().try(Joi.boolean(), Joi.number().integer().valid(0, 1)).optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional(),
  media: Joi.array().items(Joi.object({
    id: Joi.number().integer().optional(),
    original_name: Joi.string().max(255).optional(),
    upload_path: Joi.string().max(500).optional(),
    mime_type: Joi.string().max(100).optional(),
    alt_text: Joi.string().max(255).optional(),
  })).optional(),
  category_id: Joi.number().integer().required(),
  category: Joi.object({
    id: Joi.number().integer().optional(),
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).optional(),
  }).optional(),
});
