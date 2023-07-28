import * as helper from '../../../utilities/scriptFunctionHelper'
import * as og from "omegga";
import { ChunkData, MineableBlock } from 'src/typescript_definitions/plugin';
import { Surface } from 'src/game_behavior_core/world/surface';

let scriptFunctions: {[key: string]: (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>any} = {

    'mining__decrement_health':
    function decrement_health(parameters:{[key:string]:any}, dynamic_parameters:{[key:string]:any}): void {
        helper.inputGuard(parameters, "amount"); helper.inputGuard(dynamic_parameters, "surface", "position", "block", "damageMod");
        
        let surface : Surface = dynamic_parameters.surface;
        let position : {absolutePosition : og.Vector, memoryPosition:{ relativeSpatial : og.Vector, relativeChunk : og.Vector, section : og.Vector }} = dynamic_parameters.position;
        let block : MineableBlock = dynamic_parameters.block;
        let damageMod : number = dynamic_parameters.damageMod
        
        let sectionPosition = position.memoryPosition.section
        let relChunkPosition = position.memoryPosition.relativeChunk
        let relSpatialPosition = position.memoryPosition.relativeSpatial

        let chunk : ChunkData = surface.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`]
        

        if(!(`${relSpatialPosition}` in chunk.block_states)) {
            chunk.block_states[`${relSpatialPosition}`] = {}
        }
        if(!(chunk.block_states[`${relSpatialPosition}`].health) || chunk.block_states[`${relSpatialPosition}`].health <= 0){
            chunk.block_states[`${relSpatialPosition}`].health = block.health
        }
        
        chunk.block_states[`${relSpatialPosition}`].health -= parameters.amount * damageMod

    },
    'mining__destroy': 
    function destroy(parameters:{[key:string]:any}, dynamic_parameters:{[key:string]:any}): void{
        helper.inputGuard(parameters, "replace");  helper.inputGuard(dynamic_parameters, "surface", "position");
        let surface : Surface = dynamic_parameters.surface;
        let position : og.Vector = dynamic_parameters.position;
        let replace : string = parameters.replace;

        surface.setBlockAtPosition(replace, position)
    },
    'mining__return_items': 
    function return_item(parameters:{[key:string]:any}, dynamic_parameters:{[key:string]:any}): {[item:string]:number} {
        helper.inputGuard(parameters, "loot_table")
        let lootResults : {[item:string]: number} = {}
        let loot_table : {[item:string]: {amount: number | [number,number], chance: number}} = parameters.loot_table
        
        let lootTableKeys = Object.keys(loot_table)
        for (let i = 0; i < lootTableKeys.length; i++) {
            const item = loot_table[lootTableKeys[i]];
            if(item.chance < Math.random()) continue;
            let amount : number;
            if(typeof(item.amount) === 'number'){
                amount = item.amount
            } else {
                amount = item.amount[0]+Math.round((item.amount[1]-item.amount[0])*Math.random())
            }

            lootResults[lootTableKeys[i]] = amount
        }
        return lootResults
    }

}
export default scriptFunctions






