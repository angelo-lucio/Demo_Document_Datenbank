import express, { Request, Response } from 'express';
import { MongoClient, Db, IntegerType, Int32 } from 'mongodb'
import { faker } from '@faker-js/faker';

const app = express();
app.use(express.json());

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'rpg_demo_ts';
let db: Db;

// Define Items --> struct

interface Item {
    id: string;
    name: string;
    type: "weapon" | "consumable" | "quest_item" | "throwable"; // Strict Types!
    damage?: number;
    heal_amount?: number;
    quantity?: number;
    durability?: number;
}

// define player

interface Player {
    _id: string;
    username: string;
    stats: {
        hp: number;
        max_hp: number;
        energy: number;
    };
    inventory: Item[];
}


// start connection to MongoDB

async function startServer() {          //async --> wait server start
    try {                               // try or catch --> log the connection error
        await client.connect();         //await --> wait database connection
        console.log("Verbunden mit MongoDB Datenbank");
        db = client.db(dbName);
    
        app.listen(3000, () => {
            console.log("🚀 Server läuft auf http://localhost:3000");
        });
    } catch (error) {
        console.error("Verbindungsfehler:", error);
    }
}


// initialize demo

app.post('/init', async (req: Request, res: Response) => {
    const players = db.collection<Player>('players');
    
    // delete previous player to clean 
    
    await players.deleteOne({ _id: "fat tony" });

    // new player

    const newTony: Player = {
        _id: "fat tony",
        username: "FatTony",
        stats: { hp: 50, max_hp: 150, energy: 300 }, 
        inventory: [
            { id: "w_1", name: "Repulsor", type: "weapon", damage: 150, durability: 3 },
            { id: "c_1", name: "Nano-Potion", type: "consumable", heal_amount: 50, quantity: 5 },
            { id: "w_2", name: "Revolver", type: "weapon", damage: 70, durability: 5 },
            { id: "c_2", name: "Elisir of the carribean", type: "consumable", heal_amount: 100 },
            { id: "q_1", name: "Excalibur", type: "quest_item", quantity: 1 },
            { id: "q_2", type: "quest_item", name: "red_key", quantity: 50 },
            { id: "w_3", type: "throwable", name: "granate", quantity: 4, damage: 350 },
            { id: "q_3", name: "green_key", type: "quest_item", quantity: 7 },
            { id: "c_3", name: "pope_marjia", type: "consumable", quantity: 10, heal_amount: -35 }
        ]
    };

    await players.insertOne(newTony);
    res.json({ message: "Spielwelt zurückgesetzt. Tony ist bereit.", player: newTony });
});

// game loading

app.get(`/player/:id`, async (req: Request, res: Response) => {
    const player = await db.collection<Player>(`players`).findOne({ _id: req.params.id });
    if (!player) {
        res.status(404).json({ error: "Spieler nicht gefunden" });             // if wrong player
        return;
    }
    res.json(player);
});

// post to use a item trough API-request 

app.post(`/player/:id/use`, async (req: Request, res: Response) => {
    const playerId = req.params.id;
    const { itemId } = req.body;                                       // in raw .json post item id to search, call a item from the Tony-bag  

    const players = db.collection<Player>(`players`);

    //search the item

    const player = await players.findOne({ _id: playerId, "inventory.id": itemId, });
    
    if (!player) {
        res.status(400).json({ error: "Item nicht im Inventar!" });
        return;
    }

    // if term for items to use
    const item = player.inventory.find(i => i.id === itemId );
    if (!item) return;

    //const itemToUse = player.inventory.find(i => i.id === itemId);

    /* if (!itemToUse || itemToUse.type !== `consumable` || !itemToUse.heal_amount) {
        res.status(400).json({ error: "Dieses Item kann nicht konsumiert werden." });
        return;
    } */

    // check quantity and delete item if no more avaiable 
   
    if (item.type === `weapon` || item.type === 'throwable') {
        if (item.type == 'throwable' && ( item.quantity || 0) < 1 || item.type == 'weapon' && ( item.durability || 0) < 1) {
            res.status(400).json({ info : `${item.name} nicht mehr verfügbar. Das war das letzte Stück!` })

            await players.updateOne(
                { _id: playerId },
                {
                    $pull: {
                        inventory: {id: itemId}
                    }
                })
            return;
        }

        const damage = item.damage || 10; // 10 for weapon without definition

        if (item.type === 'throwable') {

        await players.updateOne(
            { _id: playerId, "inventory.id": itemId },
        {
            $inc: {
                "inventory.$.quantity": -1,           
    }

    })}
        if (item.type === 'weapon') {
            await players.updateOne(
                { _id: playerId, "inventory.id": itemId },
                {
                    $inc: {
                        "inventory.$.durability": -1
                    }
                }
                

            )
        }

        res.json({
            message: `Du schiesst mit ${item.name}! Boom!`,
            action: "attacke",
            damage: damage,
            feedback: `Dein Gegner ist getroffen! Sein Hp sinkt um ${item.damage}?`             
        }); return;
    }

    if (item.type === `consumable`) {
        //if quantity 0
        if (( item.quantity || 0) < 1) {
            res.status(400).json({ error: "kein Kuttel für die Katzen! Die Flasche ist leer..." });
            return;
        }

        if (player.stats.hp >= player.stats.max_hp && ( item.heal_amount || 0 ) > 0 ) {
            res.status(400).json({ error: "Deine Hp sind auf Maximum, kein Durst im Moment!"});
            return;
        }
        
        const heal = item.heal_amount || 0;
        
        // update the quantity and the lifestate, after use
        
    await players.updateOne(
        { _id: playerId, "inventory.id": itemId },
        {
            $inc: { 
                "stats.hp": heal,                   // heal up
                "inventory.$.quantity": -1         // quantity down
            }
        }
    );

      //special item
    if (item.name === "pope_marjia") {
            res.json ({
                message: "Oh sh**! Here we go, again....Paaff! Paaff!!",
                action: "get_stoned",
                feedback: `Schau, dass es nicht zur Gewohneit wird! Deine Hp sinken um ${item.heal_amount}`
            })
        };

    res.json({ 
        message: `Aaaahhh, erfrischend! :P ${item.name} benutzt!`, 
        action: heal,
        hp_restored: heal 
    });
    return;
}

// quest items
if (item.type === "quest_item") {
    res.json({
        message: `Du hast ${item.name} aus deinem Rücksack geholt.`,
        action: "inspect and use",
        info: `Benutze ${item.name} weise, könnte wichtig sein.`
    });
    return;
}
})

app.delete('/player/:id/delete', async (req: Request, res: Response) => {
    const playerId = req.params.id;
    const { itemId } = req.body;  

    const players = db.collection<Player>(`players`);

    const player = await players.findOne({ _id: playerId, "inventory.id": itemId, });
    
    if (!player) {
        res.status(400).json({ error: "Ist bereits weg!" });
        return;
    }

    // if term for items to use
    const item = player.inventory.find(i => i.id === itemId );
    if (!item) return;

    await players.updateOne(
                { _id: playerId },
                {
                    $pull: {
                        inventory: {id: itemId}
                    }
                })
    res.json({
        message: `Du hast ${item.name} weggeworfen!`,
        action: "entsorgen",
        info : `${item.name} ist nicht mehr verfügbar`
    })
}
)

app.put('/player/:id/add', async (req: Request, res: Response) => {
    const playerId = req.params.id;
    const newItem = req.body;  

    const players = db.collection<Player>(`players`);

    if(!newItem.id || !newItem.type || !newItem.name) {
        res.status(400).json({error: "Daten unvollständig!"})
        return;
    }

    const result = await players.updateOne(
                { _id: playerId },
                {
                 $push: {inventory: newItem }
                }
            );
            
            if (result.matchedCount === 0) {
                res.status(404).json({error: "Player nicht gefunden..."});
                return;
            }

            res.json({
                message: `${newItem.name} von Typ ${newItem.type} wird in Rücksack versorgt.`,
                item: newItem
            });
        });
startServer();
