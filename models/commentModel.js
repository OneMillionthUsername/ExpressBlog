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
}   