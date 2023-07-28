import { Block, MineableBlock, MineableBlockJson, NaturalBlock } from "src/typescript_definitions/plugin";
import { Game } from "../core_handlers/game_handler";
import { OmeggaHandler } from "../core_handlers/omegga_handler";

/**
 * A class where all information related to blocks are stored.
 */
export class BlockSource {

    public blocks: {[key: string]: Block | NaturalBlock | MineableBlock} = {}

    constructor(blocks : Array<Block | NaturalBlock | MineableBlock>){
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            this.blocks[block.name] = block
        }
    }

    public static json2Blocks(...JsonObjects : {[key:string]:any}[]): Block[]{
        let notices : {[keys:string]:string} = {}
        let blocks : Block[] = []
        
        for (let a = 0; a < JsonObjects.length; a++) {
            const JsonObject = JsonObjects[a];
            //Block
            const BlockKeys = Object.keys(JsonObject.Block)
            for (let i = 0; i < BlockKeys.length; i++) {
                const key = BlockKeys[i]
                const basicBlock = JsonObject.Block[key];
                if(!("visibility" in basicBlock)){
                    basicBlock.visibility = true;
                }
                blocks.push(basicBlock)
            }
            //Natural Block
            const NaturalBlockKeys = Object.keys(JsonObject.NaturalBlock)
            for (let i = 0; i < NaturalBlockKeys.length; i++) {
                const key = NaturalBlockKeys[i]
                const naturalBlock = JsonObject.NaturalBlock[key];
                if(!("visibility" in naturalBlock)){
                    naturalBlock.visibility = true;
                }
                blocks.push(naturalBlock)
            }
            //Mineable Block
            const MineBlockKeys = Object.keys(JsonObject.MineableBlock)
            for (let i = 0; i < MineBlockKeys.length; i++) {
                const key = MineBlockKeys[i]
                const blockData : MineableBlockJson = JsonObject.MineableBlock[key]
                const jsonScriptResults = this.jsonScriptCall2Function(blockData)
                notices = {...jsonScriptResults.notices, ...notices}
                const functionCollectionObject: Omit<MineableBlock, keyof NaturalBlock | "health" | "minimum_level"> = jsonScriptResults.data as any
                const mineableBlock : any = {
                    ...blockData,
                    ...functionCollectionObject
                };
                if(!("visibility" in mineableBlock)){
                    mineableBlock.visibility = true;
                }
                blocks.push(mineableBlock)
            }
        }
        
        const noticeKeys = Object.keys(notices)
        for (let i = 0; i < noticeKeys.length; i++) {
            console.info(notices[noticeKeys[i]])
        }
        return blocks
    }

    private static jsonScriptCall2Function(blockData : {[keys:string]:any}): {data:{[keys:string]:any}, notices: {[keys:string]:string}} {
        const blockDataKeys = Object.keys(blockData)

        let functionCollectorObject = {}
        let notices : {[keys:string]:string} = {}

        for (let j = 0; j < blockDataKeys.length; j++) {
            if(!blockDataKeys[j].match("on_")) continue;
            const functionArray = blockData[blockDataKeys[j]];
            if(!functionArray) continue;
            for (let k = 0; k < functionArray.length; k++) {
                const value = functionArray[k];

                let resultFunction : (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>any = OmeggaHandler.game.function_scripts_source.mining[value.function_name]
                if(!resultFunction) { notices[value.function_name] = `Mining Function '${value.function_name}' doesn't exist!`; continue;}
                if(!functionCollectorObject[blockDataKeys[j]]) functionCollectorObject[blockDataKeys[j]] = []
                let functionObjectDictionary = functionCollectorObject[blockDataKeys[j]] as {[functionName:string]:(parameters:{[key:string]:any})=>any}
                functionObjectDictionary[value.function_name] = (dynamicParameters) => { return resultFunction(value.parameters, dynamicParameters)}
            }
        }
        return {data : functionCollectorObject, notices : notices}
    }
}

