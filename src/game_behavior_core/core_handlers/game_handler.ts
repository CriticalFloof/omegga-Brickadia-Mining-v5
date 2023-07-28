import { Surface, SurfaceHandler } from "../world/surface";
import { BlockSource } from "../data_sources/data_source_blocks";
import { ItemSource } from "../data_sources/data_source_items";
import { FunctionScriptSource } from "../data_sources/data_source_function_scripts";
import { PlayerHandler } from "../player/player";
import { ScriptFunc_Mining } from "src/data/startup/scriptFunctions";
import MeleeSwingHandler from 'src/melee_interact/on_melee_swing';

import * as block_source_layers from '../../data/startup/object_sources/block/layers.json';
import * as block_source_ores from '../../data/startup/object_sources/block/ores.json';

import * as item_source_data from '../../data/startup/object_sources/item/item_source.json';

import { SpatialVector } from "src/typescript_definitions/plugin";
import { performance } from "perf_hooks";
import { SaveManager } from "src/file_saver/save";


export class Game {

    public state : string = "off"
    public pluginRootPath : string = `${__dirname}/..`

    public function_scripts_source : FunctionScriptSource
    public block_source : BlockSource
    public item_source : ItemSource
    public playerHandler : PlayerHandler = new PlayerHandler()
    public surfaceHandler : SurfaceHandler = new SurfaceHandler()

    private meleeHandler : MeleeSwingHandler

    constructor(){ 

        new SaveManager(this)

        let scriptFunctions: {[key: string]: (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>void} = { 
        ...ScriptFunc_Mining
        //More scriptFunction files will be added later.
        }

        this.function_scripts_source = new FunctionScriptSource(scriptFunctions)
        this.item_source = new ItemSource(ItemSource.json2Items(item_source_data))
        // Block source requires a finished reference of function_scripts_source
        setImmediate(()=>{this.block_source = new BlockSource(BlockSource.json2Blocks(block_source_layers, block_source_ores))}) 
    }

    public async start() {

        const spawnLocation : SpatialVector = [0,0,-16]

        this.state = "starting";
        Game.broadcast(`<size="28">Starting up...</>`)

        await Omegga.getAllPlayerPositions().then(async (value)=>{
            for (let i = 0; i < value.length; i++) {
                const iPlayerPosition = value[i];
                await this.playerHandler.initializePlayer(iPlayerPosition.player.name)
            }

            this.playerHandler.startPositionUpdater(100)
            this.meleeHandler = new MeleeSwingHandler(75); this.meleeHandler.signalTo.push(this.playerHandler);
        })

        //Keep in mind, the plugin will eventually slow down to an unresponsive state, I'm not even sure I can even find the cause, given that it takes over 12 hours before this becomes an issue.
        //That said, just restart the plugin at that point.
        let autoSaverTimerID = setInterval(()=>{
            if(this.state === "off"){
                clearInterval(autoSaverTimerID)
            }
            const t0 = performance.now()
            console.log('Starting autosave...')
            SaveManager.saveGame(this).catch(()=>{
                console.error('Game could not save.')
            }).then(()=>{
                const t1 = performance.now()
                console.log(`Game saved in ${(t1-t0).toFixed(3)}ms!`)
            })
        },60000*1)

        Omegga.clearAllBricks(true)

        await this.surfaceHandler.initializeSurface("Earth", {offset: [0,0,1_024_000], owner_index: 2})
        let surface : Surface = this.surfaceHandler.surfaces["Earth"]

        const playerKeys = Object.keys(this.playerHandler.players)
    
        //Teleport the players before the render. Only exists so players can see the plugin loading the world
        for (let i = 0; i < playerKeys.length; i++) {
            const player = this.playerHandler.players[playerKeys[i]];
            player.teleportPlayer(surface.spatialToWorld([spawnLocation[0]+2,spawnLocation[1]+2,spawnLocation[2]+2]))
        }
    
        await this.surfaceHandler.renderSurface(surface.name, 512)
    
        surface.generateStructure("basic_spawn", spawnLocation)
    
        //Teleport the players after the render. So they are not out of bounds.
        for (let i = 0; i < playerKeys.length; i++) {
            const player = this.playerHandler.players[playerKeys[i]];
            player.teleportPlayer(surface.spatialToWorld([spawnLocation[0]+2,spawnLocation[1]+2,spawnLocation[2]+2]))
        }
        this.state = "on";
    }

    public async stop() {
        this.state = "finishing"

        this.playerHandler.stopPositionUpdater()
        this.meleeHandler.stopCheck()

        this.state = "off"
    }

    /**
     * Allows easy distinguishing from game events and players in the chat by prefixxing a colored character.
     */
    public static whisper(receiver: string, message: string){
        const gameSpeakIdentifier = `<color="00ffff"><size="16">> </></>`
        Omegga.whisper(receiver,`${gameSpeakIdentifier}${message}`)
    }
    /**
     * Allows easy distinguishing from game events and players in the chat by prefixxing a colored character.
     */
    public static broadcast(message: string){
        const gameSpeakIdentifier = `<color="00ffff"><size="16">> </></>`
        Omegga.broadcast(`${gameSpeakIdentifier}${message}`)
    }

}