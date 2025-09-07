//Models define the structure of your data and interact with the database.

/**
- Schema Definition: Defines the structure of the data that will be stored in the database.
- Data Validation: Ensures that required fields are present before data is saved.
- Database Interaction: Provides a model to interact with MongoDB or other databases.
 */
import Joi from 'joi';

export class Admin {
  constructor({
    id = null,
    username = '',
    password_hash = '',
    email = null,
    full_name = null,
    role = 'admin',
    active = true,
    last_login = null,
    login_attempts = 0,
    locked_until = null,
    created_at = new Date(),
    updated_at = new Date(),
  } = {}) {
    this.id = id;
    this.username = username;
    this.password_hash = password_hash;
    this.email = email;
    this.full_name = full_name;
    this.role = role;
    this.active = !!active;
    this.last_login = last_login ? new Date(last_login) : null;
    this.login_attempts = login_attempts;
    this.locked_until = locked_until ? new Date(locked_until) : null;
    this.created_at = new Date(created_at);
    this.updated_at = new Date(updated_at);
  }

  static validate(payload = {}) {
    return adminSchema.validate(payload, { abortEarly: false, stripUnknown: true });
  }
}

export const adminSchema = Joi.object({
  id: Joi.number().integer().optional(),
  username: Joi.string().min(1).max(100).required(),
  password_hash: Joi.string().min(8).required(),
  email: Joi.string().email().required(),
  full_name: Joi.string().min(2).max(200).optional(),
  role: Joi.string().valid('admin', 'editor', 'viewer').required(),
  active: Joi.boolean().optional(),
  last_login: Joi.date().optional(),
  login_attempts: Joi.number().integer().min(0).optional(),
  locked_until: Joi.date().optional(),
  created_at: Joi.date().required(),
  updated_at: Joi.date().optional(),
});
