import Joi from 'joi';

export class Card{
  constructor({
    id = null,
    title = '',
    subtitle = '',
    link = '',
    img_link = '',
    published = false,
  } = {})
  {
    this.id = id;
    this.title = title;
    this.subtitle = subtitle;
    this.link = link;
    this.img_link = img_link;
    this.published = published;
  }

  static validate(payload = {}) {
    return cardSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const cardSchema = Joi.object({
  id: Joi.number().integer().optional(),
  title: Joi.string().min(2).max(200).required(),
  subtitle: Joi.string().min(2).max(200).optional(),
  link: Joi.string().uri().required(),
  img_link: Joi.string().uri().optional(),
  published: Joi.boolean().optional(),
});
