import * as og from "omegga";
import { Surface } from "../world/surface";
import { ChunkData, SpatialVector } from "src/typescript_definitions/plugin";
import { BrickLoader } from "src/brick functions/brick_loader";
import { Player } from "../player/player";

export class TerrainInteractionHandler{


    constructor(){
    }

    public static digCubic(position : SpatialVector, extent : SpatialVector, surface : Surface, player : Player, options?: { damageMod? : number }){
        if(options == undefined) options = {}
        if(options.damageMod == undefined) options.damageMod = 1

        let chunkPositionPairs = [
            surface.spatialToChunk([position[0]-(extent[0]+1),position[1]-(extent[1]+1),position[2]-(extent[2]+1)]),
            surface.spatialToChunk([position[0]+(extent[0]+1),position[1]+(extent[1]+1),position[2]+(extent[2]+1)])
        ]

        let chunkPositionDifference = [
            chunkPositionPairs[1][0] - chunkPositionPairs[0][0],chunkPositionPairs[1][1] - chunkPositionPairs[0][1],chunkPositionPairs[1][2] - chunkPositionPairs[0][2]
        ]

        for (let x = 0; x <= chunkPositionDifference[0]; x++) {
            for (let y = 0; y <= chunkPositionDifference[1]; y++) {
                for (let z = 0; z <= chunkPositionDifference[2]; z++) {
                    let chunkPosition : og.Vector = [chunkPositionPairs[0][0]+x,chunkPositionPairs[0][1]+y,chunkPositionPairs[0][2]+z]
                    let sectionPosition = surface.chunkToSection(chunkPosition)
                    let relChunkPosition = surface.chunkToRelative(chunkPosition)

                    if(!(`${sectionPosition}` in surface.sections) || !(`${relChunkPosition}` in surface.sections[`${sectionPosition}`].chunks)){
                        surface.chunk_generator.generateNewChunk( chunkPosition, surface )
                    }
                }
            }
        }

        let positions : og.Vector[] = new Array((extent[0]*2+1)*(extent[1]*2+1)*(extent[2]*2+1))

        for (let x = 0, i = 0; x < extent[0]*2+1; x++) {
            for (let y = 0; y < extent[1]*2+1; y++) {
                for (let z = 0; z < extent[2]*2+1; z++, i++) {
                    positions[i] = [position[0]+x-extent[0],position[1]+y-extent[1],position[2]+z-extent[2]]
                }
            }
        }

        let { blockMined } = this.digBase(positions, position, surface, player, { damageMod:options.damageMod })

        if(!blockMined) return
        BrickLoader.neighbourUpdateSegment(surface, [[position[0]-extent[0],position[1]-extent[1],position[2]-extent[2]],[position[0]+extent[0],position[1]+extent[1],position[2]+extent[2]]], {quiet: true})

    }

    private static digBase(absolute_positions : SpatialVector[], center: SpatialVector, surface : Surface, player : Player, options: { damageMod : number }): {[key:string]:any} 
    {

        let gainedItems : {[item:string]: number} = {};
        let messageUiTopic : 'Hit' | 'Mine' = "Hit"
        let dataToReturn : {[key:string]:any} = { blockMined: false }

        for (let a = 0; a < absolute_positions.length; a++) {
            const position = absolute_positions[a];

            let block = surface.getBlockAtPosition(position)
            if(!block || !('health' in block)) continue;
            
            let sectionPosition = surface.spatialToSection(position)
            let relChunkPosition = surface.chunkToRelative(surface.spatialToChunk(position))
            let relSpatialPosition = surface.spatialToRelative(position)
            let chunk : ChunkData = surface.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`]


            let onHitKeys = Object.keys(block.on_hit)
            let onHitReturns = {}
            for (let i = 0; i < onHitKeys.length; i++) {
                const on_hit_function: (parameters:{[key:string]:any}) => any = block.on_hit[onHitKeys[i]];
                onHitReturns[onHitKeys[i]] = on_hit_function({
                    block: block, 
                    position: {absolutePosition: position, memoryPosition:{ relativeSpatial : relSpatialPosition, relativeChunk : relChunkPosition, section : sectionPosition}}, 
                    surface: surface,
                    damageMod: player.level >= block.minimum_level ? options.damageMod : 0
                })
            }

            if(chunk.block_states[`${relSpatialPosition}`].health > 0) continue;
            dataToReturn.blockMined = true
            messageUiTopic = "Mine"

            let onMineKeys = Object.keys(block.on_mine)
            let onMineReturns = {}
            for (let i = 0; i < onMineKeys.length; i++) {
                const on_mine_function: (parameters:{[key:string]:any}) => any = block.on_mine[onMineKeys[i]];
                onMineReturns[onMineKeys[i]] = on_mine_function({
                    block: block, 
                    position: position, 
                    surface: surface
                })
            }
            
            if('return_items' in onMineReturns){
                let returnValue = onMineReturns['return_items'] as {[item:string]: number}
                let returnValueKeys = Object.keys(returnValue)
                for (let i = 0; i < returnValueKeys.length; i++) {
                    const amount = returnValue[returnValueKeys[i]];
                    if(!(returnValueKeys[i] in gainedItems)) gainedItems[returnValueKeys[i]] = 0;
                    gainedItems[returnValueKeys[i]] += amount
                }
            }
        }

        if(messageUiTopic === 'Hit'){
            let sectionPosition = surface.spatialToSection(center)
            let relChunkPosition = surface.chunkToRelative(surface.spatialToChunk(center))
            let relSpatialPosition = surface.spatialToRelative(center)
            let block = surface.getBlockAtPosition(center)
            if(!block || !('health' in block)) return dataToReturn;

            let health = surface.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`].block_states[`${relSpatialPosition}`].health
            if(player.level >= block.minimum_level){
                player.sendNotification(`Mining ${block.name}: ${health}`, {type: 'context_overwrite', group: 'event_terrain'})
            } else {
                player.sendNotification(`You must be level ${block.minimum_level} to mine ${block.name}.`, {type: 'context_overwrite', group: 'event_terrain'})
            }
        } else {
            if(Object.keys(gainedItems).length === 0) {
                player.sendNotification('Collected Nothing..', {type: 'context_overwrite', group: 'event_terrain'})
                return dataToReturn;
            }

            let gainedItemsKeys = Object.keys(gainedItems)

            for (let i = 0; i < gainedItemsKeys.length; i++) {
                player.addItem(gainedItemsKeys[i], gainedItems[gainedItemsKeys[i]])
            }

            let message = 'Collected<br>'

            if(gainedItemsKeys.length > 3) {
                for (let i = 0; i < 4; i++) {
                    const amount = gainedItems[gainedItemsKeys[i]];
                    message += `${amount} ${gainedItemsKeys[i]}<br>`
                }
                message += `and ${gainedItemsKeys.length - 3} more unique item(s).`
            } else {
                for (let i = 0; i < gainedItemsKeys.length; i++) {
                    const amount = gainedItems[gainedItemsKeys[i]];
                    message += `${amount} ${gainedItemsKeys[i]}<br>`
                }
            }
         
            player.sendNotification(message, {type: 'context_overwrite', group: 'event_terrain'})
        }

        return dataToReturn
        
    }

    public static place(){
        //planned.
    }

}