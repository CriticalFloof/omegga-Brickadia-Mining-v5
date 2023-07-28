import * as og from "omegga";
import { Surface } from "../world/surface";
import Raycast from "src/melee_interact/raycast";
import { TerrainInteractionHandler } from "../melee_interactions/terrain";
import { performance } from "perf_hooks";
import UiHandler from "./ui_handler";
import { MathExtras } from "src/utilities/math_extras";
import { OmeggaHandler } from "../core_handlers/omegga_handler";
import { LoadManager } from "src/file_saver/save";
import * as pattern from "src/utilities/pattern";
import * as sorting from "src/utilities/sorting";
import { Game } from "../core_handlers/game_handler";

/**
 * Handles player calculations as a group
 */
export class PlayerHandler {
    public playersModifiedSinceLastSave: { [key: string]: boolean } = {};
    public players: { [key: string]: Player } = {};

    private positionUpdaterInterval: NodeJS.Timer;

    constructor() {}
    public async initializePlayer(player_name: string) {
        await LoadManager.loadPlayer(player_name);
        if (this.players[player_name]) return;
        this.createPlayer(player_name);
    }

    public createPlayer(player_name: string) {
        let playerData = Omegga.getPlayer(player_name);
        this.players[playerData.name] = new Player(playerData);
        let player = this.players[playerData.name];
        if (OmeggaHandler.game.state == "on" || OmeggaHandler.game.state == "starting") {
            player.addItem("Basic Pickaxe");
        }
        this.playersModifiedSinceLastSave[playerData.name] = true;
    }

    public async onPlayerSwing(omegga_player: og.OmeggaPlayer, weapon_name: string) {
        if (OmeggaHandler.game.state !== "on") return;
        this.players[omegga_player.name].worldInteract(weapon_name);
    }

    public async startPositionUpdater(frequency: number) {
        if (this.positionUpdaterInterval) clearInterval(this.positionUpdaterInterval);

        this.positionUpdaterInterval = setInterval(() => {
            Omegga.getAllPlayerPositions().then((activePlayers) => {
                let playerKeys = Object.keys(this.players);

                for (let i = 0; i < playerKeys.length; i++) {
                    const player = this.players[playerKeys[i]];

                    for (let j = 0; j < activePlayers.length; j++) {
                        const activePlayer = activePlayers[j];
                        if (player.player_object.name == activePlayer.player.name) {
                            player.position = activePlayer.pos as og.Vector;
                        }
                    }
                }
            });
        }, frequency);
    }

    public async stopPositionUpdater() {
        if (this.positionUpdaterInterval) clearInterval(this.positionUpdaterInterval);
    }
}

export class Player {
    public position: og.Vector = [0, 0, 0];
    public player_object: og.OmeggaPlayer;

    public inventory_weight_capacity: number;
    public inventory: {
        itemID: number[];
        amount: number[];
    };

    public level: number;
    public rank: number;

    private ui_queue: {
        timeout: number;
        duration: number;
        message: string;
        receivers: string[];
        format: "chat" | "middle_print";
        group: string;
    }[] = [];
    private ui_timeout: NodeJS.Timeout;
    private ui_active_interval: NodeJS.Timer;
    private context_state: string = "world";

    constructor(player: og.OmeggaPlayer) {
        this.player_object = player;
        this.inventory_weight_capacity = -1;

        this.inventory = {
            itemID: [],
            amount: [],
        };

        this.level = 1;
        this.rank = 0;
    }

    public static from(player_data: Player): Player {
        let player_full = new Player(player_data.player_object);

        player_full.player_object = player_data.player_object;
        player_full.inventory_weight_capacity = player_data.inventory_weight_capacity;

        player_full.inventory = player_data.inventory;

        player_full.level = player_data.level;
        player_full.rank = player_data.rank;

        return player_full;
    }

    public async worldInteract(weapon_name: string) {
        let isCrouched = await this.player_object.isCrouched();
        const rotationRegExp = new RegExp(
            `${this.player_object.controller}\\.TransformComponent0.RelativeRotation = \\(Pitch=(?<x>[\\d\\.-]+),Yaw=(?<y>[\\d\\.-]+),Roll=(?<z>[\\d\\.-]+)\\)`
        );
        const [
            {
                groups: { x, y, z },
            },
        ] = await Omegga.addWatcher(rotationRegExp, {
            exec: () => Omegga.writeln(`GetAll SceneComponent RelativeRotation Outer=${this.player_object.controller}`),
            timeoutDelay: 100,
        });

        let tool = OmeggaHandler.game.item_source.getToolByWeaponName(weapon_name);
        if (!tool) return;
        let cameraPosition: og.Vector = isCrouched
            ? [this.position[0], this.position[1], this.position[2] + 11]
            : [this.position[0], this.position[1], this.position[2] + 17];
        let positions = Raycast.spatialDDARaycast(
            cameraPosition,
            [parseFloat(x), parseFloat(y), parseFloat(z)],
            tool.range,
            OmeggaHandler.game.surfaceHandler.surfaces["Earth"]
        );
        let surface: Surface = OmeggaHandler.game.surfaceHandler.surfaces["Earth"];
        let pickedPositionResult = surface.findSolidPosition(positions);
        if (!pickedPositionResult) return;

        let t0 = performance.now();
        const blockResult = surface.getBlockAtPosition(pickedPositionResult.absolutePosition);
        if (!blockResult) {
            //Interacted with nothing.
            return;
        }
        if ("health" in blockResult) {
            //Interacted with Mineable Block
            this.closeUI();

            let damageMod = tool.baseDamage * this.level;
            TerrainInteractionHandler.digCubic(pickedPositionResult.absolutePosition, tool.effectSize, surface, this, { damageMod: damageMod });
        }
        let t1 = performance.now();
        console.log(`JS Swing took ${(t1 - t0).toFixed(3)}ms`);
    }

    public teleportPlayer(position: og.Vector) {
        Omegga.writeln(`Chat.Command /TP "${this.player_object.name}" ${position[0]} ${position[1]} ${position[2]} 0`);
    }

    public showStats() {
        const stats: string[] = [
            `Player ''${this.player_object.name}''`,
            `Rank: ${this.rank}`,
            `Level: ${this.level}`,
            `Credits: ${this.findItem("Credits") ? this.inventory.amount[this.findItem("Credits") as number] : 0}`,
        ];

        for (let i = 0; i < stats.length; i++) {
            Game.whisper(this.player_object.name, stats[i]);
        }
    }

    //Level related methods

    public levelup(amount: number) {
        const levelupCost = () => {
            const rankInfluence = this.rank === 0 ? 1 : this.rank;
            const equation = Math.trunc(Math.pow(this.level + 1, 1.3) * rankInfluence) + 50;
            return this.level > 5 ? equation : 50;
        };

        let realAmount = amount;
        const startingLevel = this.level;
        const creditIndex = this.findItem("Credits");
        if (!creditIndex) {
            Game.whisper(this.player_object.name, `You cannot afford to level up!`);
            return;
        }

        //Check if the amount makes sense

        if (amount < 0) {
            Game.whisper(this.player_object.name, `You cannot 'level up' with a negative value.`);
            return;
        }
        if (amount === 0) {
            Game.whisper(this.player_object.name, `You cannot 'level up' to your current level.`);
            return;
        }
        if (amount > 10_000) {
            realAmount = 10_000;
        }

        let resultAmount = 0;
        for (let i = 0; i < realAmount; i++) {
            const cost = levelupCost();
            if (this.level + 1 > (this.rank + 1) * 100) {
                Game.whisper(
                    this.player_object.name,
                    `You have reached your max level and need to <color="ffff00">/rankup</>! For more information about ranking up, use <color="ffff00">/help_mining rankup</>`
                );
                return;
            }
            if (this.inventory.amount[creditIndex] > cost) {
                this.inventory.amount[creditIndex] -= cost;
                this.level += 1;
                resultAmount++;
            }
        }
        if (startingLevel < this.level) {
            Game.whisper(this.player_object.name, `You have leveled up ${resultAmount} times, and are now level ${this.level}!`);
        } else {
            Game.whisper(
                this.player_object.name,
                `You need ${levelupCost()} credits to upgrade! You currently have ${this.inventory.amount[creditIndex]}`
            );
        }
    }

    public rankup() {
        // Check if player is eligible for rank up
        if (this.level < (this.rank + 1) * 100) {
            Game.whisper(
                this.player_object.name,
                `You cannot rank up until you have reached your rank's limit! Rank ${this.rank}'s limit is ${(this.rank + 1) * 100}.`
            );
            return;
        }
        this.rank += 1;
        this.level = 1;
        Game.broadcast(`${this.player_object.name} is now rank ${this.rank}!`);
    }

    public prestige() {
        // The idea behind prestige is a near complete reset. Resetting gives the player a choice between 3 possible permanent bonuses they want to keep.
        // Upon this action, the player's actions are evaluated onto a score, which determins how good the bonuses selected are.
        // This should encourage players to use their live as long as possible vs prestiging asap.
        // Another note is that score translates to credits started, a better score leads to a better head start.
        /*
            Bonus ideas include:
            Ore rarity buffs
            Value multiplier
            Ore Fortune
            Tool bonuses: reach, damage, aoe.
            Player skill multipliers
            Cost reducers
            Luck boosting
        */
    }

    //Inventory related methods

    public sellQuery(requestName: string, amount: number) {
        let items = OmeggaHandler.game.item_source.getItemsByTag(requestName);
        if (items.length === 0) items = [OmeggaHandler.game.item_source.getItemByName(requestName)];
        if (requestName === "*") items = OmeggaHandler.game.item_source.getItemsByProperty("baseSellValue");
        if (!items[0]) {
            let itemTagName: string;
            const exploded = pattern.explode(requestName.toLowerCase().replace(" ", ""));

            const itemTags = OmeggaHandler.game.item_source.getTags();
            const itemNames = OmeggaHandler.game.item_source.getItemsByProperty("baseSellValue").map((val) => val.name);
            const possibleSearches = sorting.stringLengthDifferenceQuicksort([...itemTags, ...itemNames], requestName.length);
            const possibleSearchesLowerCase = possibleSearches.map((v) => v.toLowerCase());

            itemTagName = possibleSearches[possibleSearchesLowerCase.findIndex((val) => val.indexOf(requestName.toLowerCase()) > -1)];
            if (!itemTagName) itemTagName = possibleSearches[possibleSearchesLowerCase.findIndex((val) => val.match(exploded))];

            console.log(itemTagName);

            if (itemTagName && requestName.toLowerCase() === itemTagName.toLowerCase()) {
                this.sellQuery(itemTagName, amount);
                return;
            }

            if (itemTagName) {
                Game.whisper(this.player_object.name, `'${requestName}' is not a valid selector, Did you mean '${itemTagName}'?`);
                return;
            } else {
                Game.whisper(this.player_object.name, `'${requestName}' is not a valid selector!`);
                return;
            }
        }

        let itemsSold = 0;
        let amountGained = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.baseSellValue) continue;
            let inventoryIndex = this.findItem(item.name);
            if (!inventoryIndex) continue;

            let singularItemsSold = this.removeItem(item.name, amount);
            itemsSold += singularItemsSold;
            amountGained += this.addItem("Credits", item.baseSellValue * singularItemsSold);
        }
        if (itemsSold === 0) {
            Game.whisper(this.player_object.name, `You have no items to sell!`);
            return;
        }
        Game.whisper(
            this.player_object.name,
            `You sold ${itemsSold} ${items.length === 1 ? items[0].name : itemsSold === 1 ? "item" : "items"} for ${amountGained} ${
                amountGained === 1 ? "credit" : "credits"
            }!`
        );
    }

    public addItem(ItemName: string, amount: number = 1): number {
        let item = OmeggaHandler.game.item_source.getItemByName(ItemName);
        //check if the player already has the item
        let foundIDIndex = -1;
        for (let i = 0; i < this.inventory.itemID.length; i++) {
            const checkId = this.inventory.itemID[i];
            if (item.id === checkId) {
                foundIDIndex = i;
                break;
            }
        }
        if (foundIDIndex === -1) {
            foundIDIndex = this.inventory.itemID.length;
            this.inventory.amount[foundIDIndex] = 0;
            this.inventory.itemID[foundIDIndex] = item.id;
        }
        let amountBeforeAdding = this.inventory.amount[foundIDIndex];
        this.inventory.amount[foundIDIndex] += amount;

        if (this.inventory.amount[foundIDIndex] <= 0) {
            this.inventory.amount[foundIDIndex] = null;
            this.inventory.amount = this.inventory.amount.filter((val) => {
                return val !== null;
            });
            this.inventory.itemID[foundIDIndex] = null;
            this.inventory.itemID = this.inventory.itemID.filter((val) => {
                return val !== null;
            });
            return -amountBeforeAdding;
        }
        OmeggaHandler.game.playerHandler.playersModifiedSinceLastSave[this.player_object.name] = true;
        return amount;
    }

    public removeItem(ItemName: string, amount: number = 1): number {
        let item = OmeggaHandler.game.item_source.getItemByName(ItemName);
        //check if the player already has the item
        let foundIDIndex = -1;
        for (let i = 0; i < this.inventory.itemID.length; i++) {
            const checkId = this.inventory.itemID[i];
            if (item.id === checkId) {
                foundIDIndex = i;
                break;
            }
        }

        if (foundIDIndex === -1) return 0;
        let amountBeforeRemoving = this.inventory.amount[foundIDIndex];
        this.inventory.amount[foundIDIndex] -= amount;

        if (this.inventory.amount[foundIDIndex] <= 0) {
            this.inventory.amount[foundIDIndex] = null;
            this.inventory.amount = this.inventory.amount.filter((val) => {
                return val !== null;
            });
            this.inventory.itemID[foundIDIndex] = null;
            this.inventory.itemID = this.inventory.itemID.filter((val) => {
                return val !== null;
            });
            return amountBeforeRemoving;
        }
        OmeggaHandler.game.playerHandler.playersModifiedSinceLastSave[this.player_object.name] = true;
        return amount;
    }

    public findItem(ItemName: string): number | undefined {
        let item = OmeggaHandler.game.item_source.getItemByName(ItemName);
        //check if the player already has the item
        let foundIDIndex = -1;
        for (let i = 0; i < this.inventory.itemID.length; i++) {
            const checkId = this.inventory.itemID[i];
            if (item.id === checkId) {
                foundIDIndex = i;
                break;
            }
        }
        if (foundIDIndex === -1) {
            return;
        }
        return foundIDIndex;
    }

    //UI related methods
    public getContextState() {
        return this.context_state;
    }

    public closeUI() {
        this.context_state = "world";
        this.sendNotification("<br>", { duration: 0, type: "overwrite" });
    }

    public openInventory(selectedPage: number) {
        this.context_state = "inventory";
        setTimeout(() => {
            this.context_state = "world";
        }, 60 * 60000);

        let pageGenerator = () => {
            const itemsPerPage = 12;
            let pages = Math.max(Math.ceil(this.inventory.itemID.length / itemsPerPage), 1);
            let currentPage = MathExtras.clamp(selectedPage - 1, 0, pages - 1);
            let pageContent = `Page ${currentPage + 1} of ${pages} <br>________________________________<br>`;

            for (let i = 0; i < itemsPerPage; i++) {
                if (i + itemsPerPage * currentPage >= this.inventory.itemID.length) break;

                const item = OmeggaHandler.game.item_source.getItemByID(this.inventory.itemID[i + itemsPerPage * currentPage]);

                pageContent += `${item.name} | ${this.inventory.amount[i]}<br>`;
            }
            return pageContent;
        };

        this.sendNotification(pageGenerator(), { duration: 60 * 60000, type: "overwrite", group: "ui_inventory" });
        let inventoryInterval = setInterval(async () => {
            if (this.context_state !== "inventory") {
                clearInterval(inventoryInterval);
            } else {
                this.sendNotification(pageGenerator(), { duration: 60 * 60000, type: "overwrite", group: "ui_inventory" });
            }
        }, 2000);
    }

    public sendNotification(
        message: string = "",
        options?: { timeout?: number; duration?: number; type?: "lazy" | "alert" | "context_overwrite" | "overwrite"; group?: string }
    ) {
        if (!options) options = {};
        if (!options.timeout) options.timeout = 10000;
        if (!options.duration) options.duration = 2450;
        if (!options.type) options.type = "lazy";
        if (!options.group) options.group = "unassigned";
        // add notification to the end of the array
        let lazyNotification = () => {
            this.ui_queue.push({
                timeout: options.timeout,
                duration: options.duration,
                message: message,
                receivers: [this.player_object.name],
                format: "middle_print",
                group: options.group,
            });

            if (this.ui_queue.length <= 1) {
                this.nextInUiQueue();
            }
        };

        // put notification at the start of the array and restart queue.
        let alertNotification = () => {
            this.interruptUiQueue();

            //groups will be able to clear all of its own group type
            this.ui_queue.unshift({
                timeout: options.timeout,
                duration: options.duration,
                message: message,
                receivers: [this.player_object.name],
                format: "middle_print",
                group: options.group,
            });

            this.nextInUiQueue();
        };

        // remove any cards associated with the group, set the first index, and restart queue
        let context_overwriteNotification = () => {
            this.interruptUiQueue();

            this.ui_queue = this.ui_queue.filter((val) => val.group !== options.group);
            this.ui_queue.unshift({
                timeout: options.timeout,
                duration: options.duration,
                message: message,
                receivers: [this.player_object.name],
                format: "middle_print",
                group: options.group,
            });

            this.nextInUiQueue();
        };

        // clear queue, set the first index, and restart queue
        let overwriteNotification = () => {
            this.interruptUiQueue();

            this.ui_queue = [];
            this.ui_queue.push({
                timeout: options.timeout,
                duration: options.duration,
                message: message,
                receivers: [this.player_object.name],
                format: "middle_print",
                group: options.group,
            });

            this.nextInUiQueue();
        };

        switch (options.type) {
            case "overwrite":
                overwriteNotification();
                break;
            case "context_overwrite":
                context_overwriteNotification();
                break;
            case "alert":
                alertNotification();
                break;
            case "lazy":
                lazyNotification();
                break;
        }
    }

    private nextInUiQueue() {
        clearInterval(this.ui_active_interval);
        const id = UiHandler.draftRequest(
            this.ui_queue[0].timeout,
            [this.player_object.name],
            "middle_print",
            this.ui_queue[0].duration,
            this.ui_queue[0].message
        );
        this.ui_active_interval = UiHandler.activateRequest(id)[this.player_object.name];
        this.ui_timeout = setTimeout(() => {
            this.ui_queue.shift();
            if (this.ui_queue.length > 0) {
                this.nextInUiQueue();
            } else {
                const clearId = UiHandler.draftRequest(1000, [this.player_object.name], "middle_print", 0, "<br>");
                UiHandler.activateRequest(clearId);
            }
        }, this.ui_queue[0].duration);
    }

    private interruptUiQueue() {
        clearTimeout(this.ui_timeout);
    }
}
