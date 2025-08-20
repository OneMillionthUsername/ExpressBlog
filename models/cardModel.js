export class Card{
    constructor({
        id = null,
        title = "",
        subtitle = "",
        link = "",
        img = ""
    } = {})
    {
        this.id = id;
        this.title = title;
        this.subtitle = subtitle;
        this.link = link;
        this.img = img;
    }
}