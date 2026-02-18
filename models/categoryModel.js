import Joi from 'joi';

export class Category {
  constructor({
    id = null,
    name = '',
    description = '',
    slug = '',
  } = {}) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.slug = slug;
  }

  static validate(payload = {}) {
    return categorySchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const categorySchema = Joi.object({
  id: Joi.number().integer().required(),
  name: Joi.string().max(100).required(),
  description: Joi.string().max(500).optional().allow(''),
  slug: Joi.string().max(100).required(),
});
