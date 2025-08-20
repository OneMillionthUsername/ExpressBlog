export class Post {
  constructor({
    id = null,
    slug = "",
    title = "",
    content = "",
    tags = [],
    author = "admin",
    views = 0,
    published = true,
    created_at = new Date(),
    updated_at = new Date(),
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
  }
}