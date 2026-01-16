import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb'

// --- 1. TYP-DEFINITIONEN (Interfaces) ---
// Das macht TypeScript so mächtig: Wir definieren genau, wie ein Item aussieht.
interface Item {
    id: string;
    name: string;
    type: 'weapon' | 'consumable' | 'quest_item'; // Strict Types!
    damage?: number;
    heal_amount?: number;
    quantity?: number;
    durability?: number;
}

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

// --- 2. SETUP ---
const app = express();
app.use(express.json()); // Erlaubt uns, JSON an den Server zu senden

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'rpg_demo_ts';
let db: Db;

// --- 3. DATENBANK VERBINDUNG ---
async function startServer() {
    try {
        await client.connect();
        console.log("✅ Verbunden mit JARVIS Datenbank (MongoDB)");
        db = client.db(dbName);
        
        // Server starten
        app.listen(3000, () => {
            console.log("🚀 Server läuft auf http://localhost:3000");
        });
    } catch (error) {
        console.error("Verbindungsfehler:", error);
    }
}

// --- 4. API ENDPOINTS (Für Postman) ---

// A. RESET (Für den Start der Demo)
// Setzt den Spieler auf den Anfangszustand zurück
app.post('/init', async (req: Request, res: Response) => {
    const players = db.collection<Player>('players');
    
    // Lösche alten Tony
    await players.deleteOne({ _id: "player_007" });

    // Erstelle neuen Tony
    const newTony: Player = {
        _id: "Agent_46",
        username: "IronTony",
        stats: { hp: 50, max_hp: 150, energy: 300 }, // HP Kritisch!
        inventory: [
            { id: "w_1", name: "Repulsor", type: "weapon", damage: 150, durability: 3 },
            { id: "c_1", name: "Nano-Potion", type: "consumable", heal_amount: 50, quantity: 5 },
            { id: "w_2", name: "Revolver", type: "weapon", damage: 70, durability: 5 },
            { id: "c_2", name: "Elisir of the carribean", type: "consumable", heal_amount: 100 },
            { id: "q_1", name: "Excalibur", type: "quest_item", quantity: 1 },
            { id: "q_2", type: "quest_item", name: "red_key", quantity: 50 },
            { id: "w_3", type: "weapon", name: "granate", quantity: 4 },
            { id: "q_3", name: "green_key", type: "quest_item", quantity: 7 },
            { id: "c_3", name: "pope_marjia", type: "consumable", quantity: 10, heal_amount: -35 }
        ]
    };

    await players.insertOne(newTony);
    res.json({ message: "Spielwelt zurückgesetzt. Tony ist bereit.", player: newTony });
});

// game loading

app.get('/player/:id', async (req: Request, res: Response) => {
    const player = await db.collection<Player>('players').findOne({ _id: req.params.id });
    if (!player) {
        res.status(404).json({ error: "Spieler nicht gefunden" });             // if wrong player
        return;
    }
    res.json(player);
});

// post to use a item trough API-request 

app.post('/player/:id/use', async (req: Request, res: Response) => {
    const playerId = req.params.id;
    const { itemId } = req.body;                                          // in raw .json post item id to search, call a item from the Tony-bag  

    const players = db.collection<Player>('players');

    //search the item

    const player = await players.findOne({ _id: playerId, "inventory.id": itemId });
    
    if (!player) {
        res.status(400).json({ error: "Item nicht im Inventar!" });
        return;
    }

    // if term for items to use
    const item = player.inventory.find(i => i.id === itemId);
    if (!item) return;
    //const itemToUse = player.inventory.find(i => i.id === itemId);

    /* if (!itemToUse || itemToUse.type !== 'consumable' || !itemToUse.heal_amount) {
        res.status(400).json({ error: "Dieses Item kann nicht konsumiert werden." });
        return;
    } */
    if (item.type === 'weapon') {
        if (item.quantity && item.quantity || item.durability && item.durability <=0) {
            res.status(400).json({error: "Knapp daneben ist auch vorbei! Munition aufgebraucht"});
            return;
        }

        const damage = item.damage || 10; // 10 for weapon without definition

        await players.updateOne(
            { _id: playerId, "inventory.id": itemId },
        {
            $inc: {
                "inventory.$.quantity": -1,
                "inventory.$.durability": -1
            }
        }
    );
        res.json({
            message: "Du schiesst mit ${item.name}! Boom!",
            action: "attack",
            damage: damage,
            feedback: "Dein Gegner ist getroffen! Sein Hp sinkt um ${item.damage} "             
        });
        return;
    }
        if (item.type === 'consumable') {
            //if quantity 0
            if (item.quantity && item.quantity <= 0) {
        res.status(400).json({ error: "kein Kuttel für die Katzen! Die Flasche ist leer..." });
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

    res.json({ 
        message: `Aaaahhh, erfrischend! :P ${item.name} benutzt!`, 
        action: heal,
        hp_restored: heal 
    });
    return;
}

// quest items
if (item.type === 'quest_item') {
    res.json({
        message: "Du hast ${item.name} aus deinem Rücksack geholt.",
        action: "inspect and use",
        info: "Benutze ${item.name} weise, könnte wichtig sein."
    });
    return;
}
//special item
if (item.name === "pope_marjia") {
    res.json ({
        message: "Oh sh**! Here we go, again....Paaff! Paaff!!",
        action: "get_stoned",
        feedback: "Schau, dass es nicht zur Gewohneit wird! Deine Hp sinken um ${heal.amount}"
    })
};

startServer();
})