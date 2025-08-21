import Joi from "joi";

export class Media {
    constructor({
        id = null,
        post_id = null,
        original_name = "",
        file_size = null,
        mime_type = null,
        uploaded_by = null,
        path = null,
        alt_text = null,
        used_in_posts = [],
        created_at = new Date(),
    } = {}){
        this.id = id;
        this.post_id = post_id;
        this.original_name = original_name;
        this.file_size = file_size;
        this.mime_type = mime_type;
        this.uploaded_by = uploaded_by;
        this.path = path;
        this.alt_text = alt_text;
        this.used_in_posts = Array.isArray(used_in_posts) ? used_in_posts : [];
        this.created_at = new Date(created_at);
    }

    static validate(payload = {}) {
        return mediaSchema.validate(payload, { abortEarly: false, stripUnknown: true });
    }
}

export const mediaSchema = Joi.object({
    id: Joi.number().integer().optional(),
    post_id: Joi.number().integer().required(),
    original_name: Joi.string().max(200).required(),
    file_size: Joi.number().integer().min(0).optional(),
    mime_type: Joi.string().max(100).optional(),
    uploaded_by: Joi.string().max(100).optional(),
    path: Joi.string().max(200).required(),
    alt_text: Joi.string().max(200).optional(),
    used_in_posts: Joi.array().items(Joi.number().integer()).optional(),
    created_at: Joi.date().optional()
});
