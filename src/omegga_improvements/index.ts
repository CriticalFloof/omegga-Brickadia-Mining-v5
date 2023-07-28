import * as og from "omegga";
import { getPawn } from "./player/getPawn";
import { loadSaveData } from "./server/loadSaveData";
import { bakeSaveData, loadBricks, removeSaveFile } from "./server/loadSaveDataRequesting"

export default class OmeggaImprovements {

    constructor(){
    }

    static loadSaveData(
        saveData: og.WriteSaveObject,
        options?:{
            offX?,
            offY?,
            offZ?,
            quiet?,
            correctPalette?,
            correctCustom?
        }
    ){ 
        loadSaveData(saveData, options)
    }

    static bakeSaveData(saveData: og.WriteSaveObject): Promise<string>{ 
        return bakeSaveData(saveData)
    }

    static async loadBricks(
        file: string,
        options?:{
            offX?,
            offY?,
            offZ?,
            quiet?,
            correctPalette?,
            correctCustom?
        }
    ){ 
        await loadBricks(file, options)
    }

    static removeSaveFile(file : string){
        removeSaveFile(file)
    }

    static getPawn(controller){
        return getPawn(controller)
    }
}