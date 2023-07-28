//This will handle UI requests.
import { performance } from 'perf_hooks'
import { Game } from '../core_handlers/game_handler'

export interface UiRequest {
    duration : number,
    message : string,
    receivers : string[],
    format : 'middle_print' | 'chat'
}

export default class UiHandler{
    // I dont really know what I am doing here.
    
    private static requests : {[key:string]: UiRequest} = {}
    

    public static draftRequest(timeout : number = 10000, receivers : string[] = [], format : 'middle_print' | 'chat' = 'chat', duration : number = 2450, message : string = '' ): {requestId:number, timeoutId:NodeJS.Timeout} {
        let id = performance.now()

        let timeoutId = setTimeout(()=>{
            this.deleteRequest(id)
        }, timeout)

        this.requests[id] = {
            duration : duration,
            message : message,
            receivers : receivers,
            format : format
        }

        return { requestId:id, timeoutId:timeoutId }
    }

    public static deleteRequest(id: number): void {
        delete this.requests[id]
    }

    public static activateRequest(identifiers: {requestId:number, timeoutId:NodeJS.Timeout}): {[players:string]:NodeJS.Timer} {

        clearTimeout(identifiers.timeoutId)
        const sendMessage = (playerName: string) => {

            try {
                if(playerName === '*'){
                    //Wildcard, send message to everyone.
                    if(this.requests[identifiers.requestId].format === 'chat'){
                        Game.broadcast(this.requests[identifiers.requestId].message)
                    } else {
                        for (let i = 0; i < Omegga.players.length; i++) {
                            const playerName = Omegga.players[i].name;
                            Omegga.middlePrint(playerName, this.requests[identifiers.requestId].message)
                        }
                    }
                } else {
                    if(this.requests[identifiers.requestId].format === 'chat'){
                        Game.whisper(playerName, this.requests[identifiers.requestId].message)
                    } else {
                        Omegga.middlePrint(playerName, this.requests[identifiers.requestId].message)
                    }
                }
            } catch (error) {
                console.log('Omegga attempted to send a message to a player that no longer exists, fixing...')
                return true
            }
            return false
        }

        let loopIDs: {[players:string]:NodeJS.Timer} = {}
        for (let i = 0; i < this.requests[identifiers.requestId].receivers.length; i++) {
            const receiver = this.requests[identifiers.requestId].receivers[i];
            
            sendMessage(receiver);
            let loopID = setInterval(()=>{
                if(sendMessage(receiver)){
                    this.deactivateRequest(loopID)
                    console.log('UI interval loop stopped!')
                }
                console.log(`I am looping!`)
            },2500)

            loopIDs[receiver] = loopID
            setTimeout(()=>{
                this.deactivateRequest(loopID)
                delete this.requests[identifiers.requestId]
            }, this.requests[identifiers.requestId].duration)
        }

        
        return loopIDs
    }

    public static deactivateRequest(loopID: NodeJS.Timer){
        clearInterval(loopID)
    }

    public static clearUI(playerName: string) {
        if(playerName === '*'){
            for (let i = 0; i < Omegga.players.length; i++) {
                const playerName = Omegga.players[i].name;
                Omegga.middlePrint(playerName, `<br>`)
            }
        } else {
            try {
                Game.whisper(playerName, `<br>`)
            } catch (error) {
                console.log('Omegga attempted to send a message to a player that no longer exists, ignoring.')
            } 
        }
    }

    public static getMessage(id: number): string | void {
        if(!(id in this.requests)) return
        return this.requests[id].message
    }

    public static setMessage(id: number, message: string): void {
        if(!(id in this.requests)) return
        this.requests[id].message = message
    }

    public static getReceivers(id: number): string[] | void{
        if(!(id in this.requests)) return
        return this.requests[id].receivers
    }

    public static setReceivers(id: number, receivers: string[]): void {
        if(!(id in this.requests)) return
        this.requests[id].receivers = receivers
    }

}