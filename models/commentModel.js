import Joi from "joi";

export class Comment {
  constructor({
    id = null,
    post_id = null,
    username = "Anonym",
    text = "",
    ip_address = null,
    approved = true,
    published = false,
    created_at = new Date(),
    updated_at = new Date(),
  } = {}) {
    this.id = id;
    this.post_id = post_id;
    this.username = username;
    this.text = text;
    this.ip_address = ip_address;
    this.approved = !!approved;
    this.published = !!published;
    this.created_at = new Date(created_at);
    this.updated_at = new Date(updated_at);
  }

  static validate(payload = {}) {
    return commentSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const commentSchema = Joi.object({
  id: Joi.number().integer().optional(),
  post_id: Joi.number().integer().required(),
  username: Joi.string().max(100).required(),
  text: Joi.string().max(1000).required(),
  ip_address: Joi.string().ip().required(),
  approved: Joi.boolean().optional(),
  published: Joi.boolean().optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

