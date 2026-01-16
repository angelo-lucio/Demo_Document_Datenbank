import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb'

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
    type: 'weapon' | 'consumable' | 'quest_item';  // Strict Types!
    damage?: number;
    heal_amount?: number;
    quantity?: number;
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


// database

async function startServer() {          //async --> wait server start
    try {                               // try or catch --> log the connection error
        await client.connect();         //await --> wait database connection
        console.log("Verbunden mit MongoDB Datenbank");
        db = client.db(dbName);
        
        // Server starten
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
            { id: "w_1", name: "Repulsor", type: "weapon", damage: 150 },
            { id: "c_1", name: "Nano-Potion", type: "consumable", heal_amount: 50, quantity: 5 }
        ]
    };

    await players.insertOne(newTony);
    res.json({ message: "Spielwelt zurückgesetzt. Tony ist bereit.", player: newTony });
});

// B. SPIELER LADEN (GET)
// Zeigt den aktuellen Status
app.get('/player/:id', async (req: Request, res: Response) => {
    const player = await db.collection<Player>('players').findOne({ _id: req.params.id });
    if (!player) {
        res.status(404).json({ error: "Spieler nicht gefunden" });
        return;
    }
    res.json(player);
});

// C. ITEM BENUTZEN (POST)
// Die Magie: Atomares Update
app.post('/player/:id/use', async (req: Request, res: Response) => {
    const playerId = req.params.id;
    const { itemId } = req.body; // Wir erwarten { "itemId": "c_1" }

    const players = db.collection<Player>('players');

    // 1. Suche das Item, um zu wissen, wie viel es heilt
    // (In einer echten App würden wir das aus einer Item-Datenbank holen, hier aus dem Inventar)
    const player = await players.findOne({ _id: playerId, "inventory.id": itemId });
    
    if (!player) {
        res.status(400).json({ error: "Item nicht im Inventar!" });
        return;
    }

    // Finde das spezifische Item im Array (Typescript Array Find)
    const itemToUse = player.inventory.find(i => i.id === itemId);
    if (!itemToUse || itemToUse.type !== 'consumable' || !itemToUse.heal_amount) {
        res.status(400).json({ error: "Dieses Item kann nicht konsumiert werden." });
        return;
    }

    if (itemToUse.quantity && itemToUse.quantity <= 0) {
        res.status(400).json({ error: "Item aufgebraucht!" });
        return;
    }

    // 2. Führe das Update in der DB aus
    const result = await players.updateOne(
        { _id: playerId, "inventory.id": itemId },
        {
            $inc: { 
                "stats.hp": itemToUse.heal_amount, // HP erhöhen
                "inventory.$.quantity": -1         // Anzahl verringern ($ ist der Index des Items)
            }
        }
    );

    res.json({ 
        message: `Gluck gluck... ${itemToUse.name} benutzt!`, 
        healed: itemToUse.heal_amount 
    });
});

startServer();