import * as og from 'omegga';
import MineTestGame from "omegga.plugin";
import { Game } from "./game_handler";
import { readFileSync } from 'fs';
import { SaveManager } from 'src/file_saver/save';
import { Manual } from '../help_manuals/manual';

// This file implements and registers omegga listeners

export class OmeggaHandler {

    public static game = new Game()

    private static dev_mode_users: string[] = []

    public static registerListeners(plugin : MineTestGame): { registeredCommands: string[] }{
        //reads this file, for chat command names and returns them. 
        //while unconventional, since all chat commands are declared here and it's my project, I don't really care, lol.
        let commandsToRegister : string[] = readFileSync(`${__dirname}/../src/game_behavior_core/core_handlers/omegga_handler.ts`, {encoding: "utf-8"}).match(/(?<=omegga\.on\('cmd:|omegga\.on\('chatcmd:).*?(?=')/gm)
        this.defineAutomaticListeners(plugin)
        this.addRestrictedCommandListeners(plugin)
        this.addDefaultCommandListeners(plugin)
        this.addTrustedCommandListeners(plugin)
        this.addDeveloperCommandListeners(plugin)
        return { registeredCommands: commandsToRegister };
    }

    //////

    private static defineAutomaticListeners(plugin : MineTestGame) {
        plugin.omegga.on('join', (player: og.OmeggaPlayer) => {
            //Whenever this code throws, it's because omegga hasn't loaded the player in yet.
            if(this.game.state === 'on'){
                let loopID = setInterval(()=>{
                    try {
                        this.game.playerHandler.initializePlayer(player.name)
                        clearInterval(loopID)
                    } catch (error) {
                        console.log(`Player '${player.name}' hasn't loaded in yet...`)
                    }
                },1000)
            }
        })

        plugin.omegga.on('leave', (omegga_player: og.OmeggaPlayer) =>{
            const player = this.game.playerHandler.players[omegga_player.name]
            SaveManager.savePlayer(player,`${SaveManager.savePath}/Players/${player.player_object.name}`)
        })
    }

    private static addRestrictedCommandListeners(plugin : MineTestGame) {
        //These commands are always accessible

        plugin.omegga.on('cmd:help_mining',(speaker: string, sectionName: string = "Basic", page: string = "1") => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Prints a page in the help manual"

            const pageInt = parseInt(page);
            try {
                this.validateInputs([pageInt],["number"])
            } catch (error) {
                plugin.omegga.whisper(speaker,this.showUsage(`help_mining`, ['Section Name', 'Page Number'], [false, false], description))
                return;
            }
            const pageContents = Manual.getPage(sectionName, pageInt-1)
            for (let i = 0; i < pageContents.length; i++) {
                const line = pageContents[i];
                Game.whisper(speaker, line);
            }

        });

        plugin.omegga.on('cmd:stats', (speaker: string)=>{
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}
            const description = "Shows the speaker their game stats"
            this.game.playerHandler.players[speaker].showStats()
        });
        
        plugin.omegga.on('cmd:sell', (speaker: string, amount: string = "all", ...searchQuery: string[]) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Sells items from your inventory"

            const amountInt = amount === "all" ? Infinity : parseInt(amount)
            try {
                this.validateInputs([amountInt],["number"])
            } catch (error) {
                if(!(amountInt === Infinity)){
                    plugin.omegga.whisper(speaker,this.showUsage(`sell_items`, ['Amount', 'Item Name or Tag'], [true, true], description))
                    return;
                }
            }
            if(searchQuery.length === 0){
                plugin.omegga.whisper(speaker,this.showUsage(`sell_items`, ['Amount', 'Item Name or Tag'], [true, true], description))
                return;
            }

            // This is my cry for brickadia GUIs, please,,
            this.game.playerHandler.players[speaker].sellQuery(searchQuery.join(' ').replace(/\s+/g,' ').trim(), amountInt)
        });

        plugin.omegga.on('cmd:close', (speaker: string) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}
            this.game.playerHandler.players[speaker].closeUI()
        });

        plugin.omegga.on('cmd:inventory', (speaker: string, page: string = '1') => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Checks your inventory, optionally by page"
            const pageInt = parseInt(page)
            try {
                this.validateInputs([pageInt], ['number'])
            } catch (error) {
                plugin.omegga.whisper(speaker,this.showUsage(`inventory`, ['Page Number'], [false], description))
                plugin.omegga.whisper(speaker,this.showUsage(`i`, ['PageNumber'], [false], description))
            }
            if(this.game.playerHandler.players[speaker].getContextState() === "world"){
                this.game.playerHandler.players[speaker].openInventory(pageInt)
            } else {
                this.game.playerHandler.players[speaker].closeUI()
            }
            
        });

        plugin.omegga.on('cmd:i', (speaker: string, page: string = '1') => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Checks your inventory, optionally by page"
            const pageInt = parseInt(page)
            try {
                this.validateInputs([pageInt], ['number'])
            } catch (error) {
                plugin.omegga.whisper(speaker,this.showUsage(`inventory`, ['Page Number'], [false], description))
                plugin.omegga.whisper(speaker,this.showUsage(`i`, ['PageNumber'], [false], description))
            }
            if(this.game.playerHandler.players[speaker].getContextState() === "world"){
                this.game.playerHandler.players[speaker].openInventory(pageInt)
            } else {
                this.game.playerHandler.players[speaker].closeUI()
            }
        });

        plugin.omegga.on('cmd:equip', (speaker: string, ...requestedToolFragmented: string[]) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Allows you to spawn in a 'weapon' for yourself if you have one in your inventory"
            const requestedTool = requestedToolFragmented.join(' ')
            
            const weapon = OmeggaHandler.game.item_source.getWeaponByToolName(requestedTool) as og.WeaponClass | void
            if(!weapon){
                plugin.omegga.whisper(speaker,this.showUsage(`equip`, ['Tool Name'], [true], description))
                return;
            }
            const player = OmeggaHandler.game.playerHandler.players[speaker]
            const itemIndex = player.findItem(requestedTool)
            
            if(itemIndex == undefined || player.inventory.amount[itemIndex] == undefined || player.inventory.amount[itemIndex] === 0 ){
                Game.whisper(speaker,`You do not have a ${requestedTool}!`)
                return;
            }

            player.player_object.giveItem(weapon)

            Game.whisper(speaker, `You equipped your ${requestedTool}!`)
        });

        plugin.omegga.on('cmd:levelup', (speaker: string, amount: string = "1") => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}

            const description = "Levels the player up."

            const amountInt = parseInt(amount);
            try {
                this.validateInputs([amountInt],["number"])
            } catch (error) {
                plugin.omegga.whisper(speaker,this.showUsage(`levelup`, ['Amount'], [true], description))
                return;
            }

            this.game.playerHandler.players[speaker].levelup(amountInt)
        });

        plugin.omegga.on('cmd:rankup', (speaker: string) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}
            const description = "Ranks the player up."
            this.game.playerHandler.players[speaker].rankup()
        });

        plugin.omegga.on('cmd:position', (speaker: string) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}
            const position = this.game.surfaceHandler.surfaces["Earth"].worldToSpatial(this.game.playerHandler.players[`${speaker}`].position)

            Game.whisper(speaker, `You are located at, <size="22">X: <color="ffff00">${position[0]}</>, Y: <color="ffff00">${position[1]}</>, Z: <color="ffff00">${position[2]}</></>`)
        });
    }

    private static addDefaultCommandListeners(plugin : MineTestGame) {
        //These commands should only be accessible if the user has default permissions
    }

    private static addTrustedCommandListeners(plugin : MineTestGame) {
        //These commands should only be accessible if the user has elevated permissions
        plugin.omegga.on('cmd:sudo_teleport', (speaker: string, x: string, y: string, z: string) => {
            if(!this.validateGameState()){plugin.omegga.whisper(speaker, this.gameNotStarted()); return;}
            if(!this.validatePermission(plugin, speaker, "Trusted")) {plugin.omegga.whisper(speaker, this.cmdNotFound()); return;}

            const description = "Teleports a player to a location inside the gameworld context"
            const xInt = parseInt(x); const yInt = parseInt(y); const zInt = parseInt(z);
            try {
                this.validateInputs([xInt,yInt,zInt],["number","number","number"])
            } catch (error) {
                plugin.omegga.whisper(speaker,this.showUsage(`sudo_teleport`, ['X','Y','Z'], [true, true, true], description))
                return;
            }
            
            this.game.playerHandler.players[speaker].teleportPlayer(this.game.surfaceHandler.surfaces["Earth"].spatialToWorld([xInt,yInt,zInt]));
        });

    }

    private static addDeveloperCommandListeners(plugin : MineTestGame) {
        //These commands should only be accessible if user has developer permissions.
        plugin.omegga.on('cmd:dev_enable', (speaker: string) => {
            if(!this.validatePermission(plugin, speaker, "Developer")) {plugin.omegga.whisper(speaker, this.cmdNotFound()); return;}
            
            let userIndex = -1
            for (let i = 0; i < this.dev_mode_users.length; i++) {
                const user = this.dev_mode_users[i];
                if(speaker === user) {
                    userIndex = i
                }
            }
            if(userIndex === -1){
                this.dev_mode_users[this.dev_mode_users.length] = speaker
                Game.whisper(speaker, '<color="00ff00">Developer Mode enabled!</>')
            } else {
                this.dev_mode_users[userIndex] = null
                this.dev_mode_users.filter((val) => { if(val === null) return false; return true });
                Game.whisper(speaker, '<color="ff0000">Developer Mode disabled!</>')
            }
            
        });

        //These commands should only be accessible if user has developer permissions AND is in developer mode.
        plugin.omegga.on('cmd:dev_startgame', (speaker: string) => {
            if(!this.validatePermission(plugin, speaker, "Developer")) {plugin.omegga.whisper(speaker, this.cmdNotFound()); return;}
            if(!this.validateDevMode(speaker)) {Game.whisper(speaker, this.devModeMissing()); return;}
            if(this.game.state !== 'off'){
                Game.whisper(speaker, 'The game is currently running!')
                return
            }
            this.game.start();
        });

        plugin.omegga.on('cmd:dev_stopgame', (speaker: string) => {
            if(!this.validatePermission(plugin, speaker, "Developer")) {plugin.omegga.whisper(speaker, this.cmdNotFound()); return;}
            if(!this.validateDevMode(speaker)) {Game.whisper(speaker, this.devModeMissing()); return;}
            if(this.game.state !== 'on'){
                Game.whisper(speaker, `The game isn't running!`)
                return
            }
            this.game.stop();
        });

    }

    //////

    private static validateInputs(inputs : unknown[], type : string[]){
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];

            if(typeof input !== type[i]){
                throw new TypeError(`Argument ${i} is type ${typeof input}. Expected ${type[i]}`)
            }

            if(typeof input === 'number' && (Number.isNaN(input) || !Number.isFinite(input))){
                throw new RangeError(`Argument ${i} is out of range or not a number.`)
            }
        }
    }

    private static validatePermission(plugin : MineTestGame, playerName: string, requestedAccess: "Default" | "Trusted" | "Developer"): boolean{
        const restrictedRole = plugin.config["Restricted role"]
        const trustedRole = plugin.config["Trusted role"]
        const devRole = plugin.config["Developer role"]

        enum status {
            Restricted,
            Default,
            Trusted,
            Developer
        }

        let player = plugin.omegga.getPlayer(playerName)
        let roles = player.getRoles()
        let permission = status.Default

        if(player.isHost) {
            permission = status.Developer
        } else {
            for (let i = 0; i < roles.length; i++) {
                if(roles[i] === restrictedRole && permission < status.Trusted) permission = status.Restricted;
                if(roles[i] === trustedRole && permission < status.Developer) permission = status.Trusted;
                if(roles[i] === devRole) permission = status.Developer;
            }
        }
        
        if(permission >= status[requestedAccess]){
            return true
        } else {
            return false
        }
    }

    private static validateDevMode(speaker: string){
        for (let i = 0; i < this.dev_mode_users.length; i++) {
            const user = this.dev_mode_users[i];
            if(speaker === user) {
                return true
            }
        }
        return false
    }

    private static validateGameState(){
        return this.game.state === "on"
    }

    private static showUsage(name: string, parameters: string[], required: boolean[], description?: string){
        let processedString = `<color="ffff00">/${name.charAt(0).toUpperCase() + name.slice(1)}</> `
        for (let i = 0; i < parameters.length; i++) {
            if(required[i]) {
                processedString += `<color="00ff00">[${parameters[i]}]</> `
            } else {
                processedString += `<color="ff0000">[${parameters[i]}]</> `
            }
        }
        if(description){
            processedString += `- ${description}`
        }
        return processedString
    }

    private static cmdNotFound() {
        return `Command not found. Type <color="ffff00">/help</> for a list of commands or <color="ffff00">/plugins</> for plugin information.`
    }

    private static devModeMissing() {
        return `This command cannot be invoked without developer mode, to enable developer mode type <color="ffff00">/dev_enable</>.`
    }

    private static gameNotStarted() {
        return `This command cannot be invoked as the game hasn't started, wait for the game to start before using them.`
    }
}