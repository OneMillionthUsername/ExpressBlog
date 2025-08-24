import Joi from "joi";

export class PostAnalytics {
  constructor({
    id = null,
    post_id = null,
    event_type = "view",
    ip_address = null,
    user_agent = null,
    referer = null,
    country = null,
    city = null,
    created_at = new Date(),
  } = {}) {
    this.id = id;
    this.post_id = post_id;
    this.event_type = event_type;
    this.ip_address = ip_address;
    this.user_agent = user_agent;
    this.referer = referer;
    this.country = country;
    this.city = city;
    this.created_at = new Date(created_at);
  }

  static validate(payload = {}) {
    return postAnalyticsSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const postAnalyticsSchema = Joi.object({
  id: Joi.number().integer().optional(),
  post_id: Joi.number().integer().min(1).required(),
  event_type: Joi.string().valid("view", "click", "share").required(),
  ip_address: Joi.string().ip().required(),
  user_agent: Joi.string().max(200).required(),
  referer: Joi.string().uri().optional(),
  country: Joi.string().max(100).optional(),
  city: Joi.string().max(100).optional(),
  created_at: Joi.date().required()
});

