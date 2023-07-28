//This code is modified from Blue guy#730

import { OmeggaPlayer } from "omegga";
import OmeggaImprovements from "../omegga_improvements/index";

export default class swingDetect{
    
    public static async getAllPlayersHeldWeapon(playerArray: OmeggaPlayer[]) {

        let omeggaPlayerPawns = []
        for (let i = 0; i < playerArray.length; i++) {
            OmeggaImprovements.getPawn(playerArray[i].controller).then((val)=>{
                if(!val) return;
                omeggaPlayerPawns[i] = val
            })
        }

        let logPlayerPawns = []
        let logWeaponPawns = []
		const reg = new RegExp(
		/BP_FigureV2_C .+?PersistentLevel\.(?<playerPawn>BP_FigureV2_C_\d+)\.WeaponSimState = .+(PersistentLevel.(Weapon|BP_Item)_|CurrentItemInstance=)(?<Weapon>.+)(_C_(?<weaponPawn>\w+)|,)/
		);
		const logResults = await Omegga.watchLogChunk(`getAll BP_FigureV2_C WeaponSimState`, reg, {
			timeoutDelay: 500
		}).catch() as RegExpMatchArray[];
        if(!logResults) return [];
        let generatedPlayerArray : OmeggaPlayer[] = []
        for (let i = 0; i < logResults.length; i++) {
            const logResult = logResults[i];
            const { playerPawn, weaponPawn } = logResult.groups
            logWeaponPawns[i] = weaponPawn
            logPlayerPawns[i] = playerPawn

            for (let j = 0; j < omeggaPlayerPawns.length; j++) {
                if(logPlayerPawns[i] === omeggaPlayerPawns[j]){ 
                    generatedPlayerArray[i] = playerArray[j]
                }
            }
        }

		return {players: generatedPlayerArray, weaponPawns: logWeaponPawns}
	}

    public static async getMeleeSwings(weapon_name: string) {
        
        const results = []
        const regexp = new RegExp(
            `(?<weaponName>${weapon_name})_C_(?<weaponPawn>.*).SimState.*bMeleeActive=(?<meleeStatus>True|False)`
        );
        const logResults = await Omegga.watchLogChunk(`getAll ${weapon_name}_C simState`, regexp, {
            
            timeoutDelay: 500
        }).catch() as RegExpMatchArray[]; 
        if(!logResults) return [];
        for (let i = 0; i < logResults.length; i++) {
            const logResult = logResults[i];
            const { weaponName, weaponPawn, meleeStatus }  = logResult.groups
            const meleeBool = meleeStatus.toLowerCase() == 'true'
            results[i] = {weaponName: weaponName, weaponPawn: weaponPawn, meleeActive: meleeBool}
        }
        return results
    }
}

