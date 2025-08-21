export class Card{
    constructor({
        id = null,
        title = "",
        subtitle = "",
        link = "",
        img = "",
        published = false
    } = {})
    {
        this.id = id;
        this.title = title;
        this.subtitle = subtitle;
        this.link = link;
        this.img = img;
        this.published = published;
    }
}