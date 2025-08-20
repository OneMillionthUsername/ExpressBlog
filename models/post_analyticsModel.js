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
}