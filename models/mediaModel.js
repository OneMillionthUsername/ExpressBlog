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
}