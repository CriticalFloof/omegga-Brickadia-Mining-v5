import { OmeggaHandler } from "../core_handlers/omegga_handler"

export class Manual{

    private static colors = ['000000','FF0000','FFFF00','00FF00','00FFFF','0000FF','FF00FF','FFFFFF']

    private static manualData: {[section: string]:Array<string[]>} = {
        basic:[
            [
                `Welcome to Brickadia Mining!`,
                `In this gamemode, you must mine resources around you to sell for credits.`,
                `Use those credits to buy upgrades and tools to mine faster!`,
                `To get started, pull out a Knife (Basic Pickaxe) and start swinging at the dirt!`,
                `If you don't have a knife, you can use ${this.col(2,`/equip Basic Pickaxe`)} to hold one because you start with one in your ${this.col(3,`Inventory`)}!`,
                `After swinging for some resources, you can use ${this.col(2,`/sell all ore`)} to sell any valuable ores you accquired!`,
                `Great job! You've just sold your first payload and you now have some credits!`,
                `Next up: Upgrading your skills ${this.col(2,`/help_mining basic 2`)}`
            ],
            [
                `Now that you obtained some credits, lets put them to use!`,
                `You can upgrade your player stats using ${this.col(2,`/levelup`)}, The first upgrade will cost 50 credits.`,
                `Note that the cost of each upgrade after level 5 is exponential!`,
                `Congratulations! You've extracted and sold some resources, and used the profits to upgrade your mining ability. You've learned the basics to mining!`,
                `For more in-depth reading on the game's mechanics, you can type ${this.col(2,`/help_mining sections`)} to explore!`
            ]
        ],
        inventory:[
            [
                `The inventory system allows you to look at all of your items at once place.`,
                `To open the inventory use ${this.col(2,`/inventory`)} (shorthand ${this.col(2,`/i`)})`,
                `To close it, type the command again, or use ${this.col(2,`/exit`)}`,
                `To navigate to other pages, ${this.col(2,`/inventory`)} has an optional page parameter`,
                `You can also use ${this.col(2,`/next`)} and ${this.col(2,`/prev`)} while looking at your inventory to switch pages`,
                `Those aforementioned commands also supports an optional number argument which specifies how many pages to go`
            ]
        ],
        item_tags:[
            (()=>{
                let processedTags: string[] = []
                let tags: string[] = []
                setImmediate(()=>{
                    tags = OmeggaHandler.game.item_source.getTags()
                    processedTags[0] = `This section is a lookup for all tags used in the game for items.`
                    for (let i = 0; i < tags.length; i++) {
                        if(processedTags[Math.trunc(i/6)+1] == undefined) processedTags[Math.trunc(i/6)+1] = '';
                        processedTags[Math.trunc(i/6)+1] += `${this.col(3,tags[i].charAt(0).toUpperCase() + tags[i].slice(1))}, `
                    }
                    for (let i = 1; i < processedTags.length; i++) {
                        processedTags[i] = processedTags[i].substring(0, processedTags[i].length-2)
                    }
                    
                })
                return processedTags
            })()
        ],
        sections:[
            (() => {
                let processedNames: string[] = []
                let sectionsNames: string[] = []
                setImmediate(()=>{
                    sectionsNames = this.listIndex()
                    for (let i = 0; i < sectionsNames.length; i++) {
                        if(processedNames[Math.trunc(i/6)] == undefined) processedNames[Math.trunc(i/6)] = '';
                        processedNames[Math.trunc(i/6)] += `${this.col(3,sectionsNames[i].charAt(0).toUpperCase() + sectionsNames[i].slice(1))}, `
                    }
                    for (let i = 0; i < processedNames.length; i++) {
                        processedNames[i] = processedNames[i].substring(0, processedNames[i].length-2)
                    }
                    processedNames[0] = `Help sections: ${processedNames[0]}`
                })
                return processedNames
            })()
        ],
    }

    public static listIndex(): string[]{
        return Object.keys(this.manualData)
    }

    public static getPage(sectionName: string, pageNumber: number): string[]{
        if(!this.manualData[sectionName.toLowerCase()]) {
            return [`Section ${sectionName} doesn't exist!`,`Sections: ${this.listIndex().join(', ')}`]
        };
        if(!this.manualData[sectionName.toLowerCase()][pageNumber]) {
            return [`Page ${pageNumber+1} of section ${sectionName} doesn't exist!`]
        };
        return this.manualData[sectionName.toLowerCase()][pageNumber]
    }

    private static col(colorIndex: number, text:string): string{
        return `<color="${this.colors[colorIndex]}">${text}</>`
    }
    private static size(size: number, text:string): string{
        return `<size="${size}">${text}</>`
    }
}