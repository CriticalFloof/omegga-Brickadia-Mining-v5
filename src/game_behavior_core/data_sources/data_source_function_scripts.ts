/**
 * A class where all information related to customizable scripts are stored.
 */
export class FunctionScriptSource {

    constructor(scripts: {[key: string]: (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>void}){
        let scriptKeys = Object.keys(scripts)
        for (let i = 0; i < scriptKeys.length; i++) {
            const script = scripts[scriptKeys[i]];
            if(scriptKeys[i].match("mining__")){
                this.mining[scriptKeys[i].replace("mining__", "")] = script
                continue;
            }
            this.other[scriptKeys[i]] = script
        }
    }

    public mining: {[key: string]: (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>void} = {}
    public other: {[key: string]: (parameters:{[key:string]:any}, dynamicParameters:{[key:string]:any})=>void} = {}
}