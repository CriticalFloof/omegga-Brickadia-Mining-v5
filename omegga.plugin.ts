import OmeggaPlugin, * as og from 'omegga';
import { OmeggaHandler } from 'src/game_behavior_core/core_handlers/omegga_handler';


type Config = { [key:string]: any };
type Storage = { [key:string]: any };

export default class MineTestGame implements OmeggaPlugin<Config, Storage> {

    public omegga: og.OL;
    public config: og.PC<Config>;
    public store: og.PS<Storage>;
    
    constructor(omegga: og.OL, config: og.PC<Config>, store: og.PS<Storage>) {
        this.omegga = omegga;
        this.config = config;
        this.store = store;
    }

    async init() {
        return OmeggaHandler.registerListeners(this)
    };

    async stop() {}
}
