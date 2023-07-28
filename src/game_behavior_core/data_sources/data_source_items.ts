import { Item, Tool } from "src/typescript_definitions/plugin";

export class ItemSource { 

    private possibleTags: string[] = []

    private itemsName: {[key: string]: Item | Tool} = {}
    private itemsID: {[key: number]: Item | Tool} = {}
    private weapon2ToolPairs: {[key: string]: Tool} = {}
    private tool2WeaponPairs: {[key: string]: string} = {}

    constructor(items : Array<Item | Tool>){
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            this.itemsName[items[i].name] = item;
            this.itemsID[items[i].id] = item;
            if("physicalRepresentation" in item) {
                this.weapon2ToolPairs[item.physicalRepresentation] = item;
                this.tool2WeaponPairs[item.name] = item.physicalRepresentation
            }
            for (let j = 0; j < item.tags.length; j++) {
                const tag = item.tags[j];
                if(!this.possibleTags.includes(tag)){
                    this.possibleTags.push(tag)
                }
            }
            
        }
    }

    public getItemsByProperty(property: string){
        let searchHits: Array<Item | Tool> = []

        let itemKeys = Object.keys(this.itemsName)
        for (let i = 0; i < itemKeys.length; i++) {
            const item = this.itemsName[itemKeys[i]];
            if(!item) continue;
            if(property in item){
                searchHits.push(item)
            }
            
        }

        return searchHits
    }

    public getTags(){
        return this.possibleTags
    }

    public getItems(){
        return Object.values(this.itemsName)
    }

    public getItemsByTag(tag: string){
        let searchHits: Array<Item | Tool> = []

        let itemKeys = Object.keys(this.itemsName)
        for (let i = 0; i < itemKeys.length; i++) {
            const item = this.itemsName[itemKeys[i]];
            if(!item || !item.tags) continue;
            if(item.tags.includes(tag)){
                searchHits.push(item)
            }
            
        }

        return searchHits
    }

    public getItemByID(id: number){
        return this.itemsID[id]
    }

    public getItemByName(name: string){
        return this.itemsName[name]
    }

    public getToolByWeaponName(name: string): Tool | void{
        return this.weapon2ToolPairs[name]
    }

    public getWeaponByToolName(name: string): string | void{
        return this.tool2WeaponPairs[name]
    }

    public static json2Items(JsonObject : {[key:string]:any}): Item[]{
        let items : Item[] = []
        
        //Item
        const JsonObjectKeys = Object.keys(JsonObject.items)
        for (let i = 0; i < JsonObjectKeys.length; i++) {
            const item : Item | Tool = JsonObject.items[JsonObjectKeys[i]];
            items.push(item)
        }
        return items
    }

}