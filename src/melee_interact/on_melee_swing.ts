import { OmeggaPlayer, WeaponClass } from "omegga";
import swingDetect from "./swing_detect";


export default class MeleeSwingNotifier{

    public signalTo = []
    public players : OmeggaPlayer[]
    private playerInstances : OmeggaPlayer[] = []
    private previouslyActive : {[playerName:string]:boolean} = {}
    private weaponPawns : string[] = []

    //note: Weapon_Longsword may show as a type error, that's because omegga's type, "Weapon_LongSword" is a typo. The string must be "Weapon_Longsword" or omegga's watchlog won't recognize the weapon
    public static readonly melee_names : Partial<WeaponClass>[] = [ //13 weapons 
        "Weapon_ArmingSword","Weapon_Battleaxe","Weapon_ChargedLongsword","Weapon_CrystalKalis",
        "Weapon_HeroSword","Weapon_HoloBlade","Weapon_Ikakalaka","Weapon_Khopesh",
        "Weapon_Knife","Weapon_Longsword","Weapon_Sabre","Weapon_Spatha","Weapon_Zweihander"
    ]

    private intervalID : NodeJS.Timer


    constructor(checkFrequency : number){
        this.startCheck(checkFrequency)
    }

    public startCheck(checkFrequency) {
        this.intervalID = setInterval(()=>{this.check()},checkFrequency)
    }

    public stopCheck() {
        clearInterval(this.intervalID)
    }

    public async check(){
        this.setPlayers()
        //Create links between the player and their weapons.
        let heldWeaponPromise = swingDetect.getAllPlayersHeldWeapon(this.players)
        heldWeaponPromise.then((value : any)=>{
            this.playerInstances = value.players
            this.weaponPawns = value.weaponPawns
        })
        //run through every valid weapon and check their simstates
        for (let x = 0; x < MeleeSwingNotifier.melee_names.length; x++) {
            const weaponName = MeleeSwingNotifier.melee_names[x];

            let swingPromise = swingDetect.getMeleeSwings(weaponName)
            swingPromise.then((values : {weaponName: string, weaponPawn: string, meleeActive: boolean}[])=>{
                values:
                for (let i = 0; i < values.length; i++) {
                    const value = values[i];
                    for (let j = 0; j < this.weaponPawns.length; j++) {
                        if(!this.playerInstances[j]) continue;
   
                        const weaponPawn = this.weaponPawns[j];
                        if(weaponPawn === value.weaponPawn){
                            if(!value.meleeActive) {
                                this.previouslyActive[this.playerInstances[j].name] = false
                                continue values;
                            }
                            if(this.previouslyActive[this.playerInstances[j].name]) continue values;

                            //Successful swing.
                            this.previouslyActive[this.playerInstances[j].name] = true
                            for (let k = 0; k < this.signalTo.length; k++) {
                                const requestor = this.signalTo[k];
                                requestor.onPlayerSwing(this.playerInstances[j], value.weaponName)
                            }
                        }
                    }
                }
            })
        }

        
    }

    private setPlayers() {
        let players : OmeggaPlayer[] = []
        let playerObjects = Omegga.getPlayers()
        for (let i = 0; i < playerObjects.length; i++) {
            if(!this.previouslyActive[playerObjects[i].name]){
                this.previouslyActive[playerObjects[i].name] = false
            }
            players[i] = Omegga.findPlayerByName(playerObjects[i].name)
        }
        this.players = players

        let previouslyActiveKeys = Object.keys(this.previouslyActive)
        for (let i = 0; i < previouslyActiveKeys.length; i++) {
            const previouslyActiveName = previouslyActiveKeys[i];
            let playerFound = false;
            for (let j = 0; j < playerObjects.length; j++) {
                const playerName = playerObjects[j].name;
                if(previouslyActiveName === playerName) playerFound = true;
            }
            if(!playerFound){
                delete this.previouslyActive[previouslyActiveName]
            }
        }
    }


}



