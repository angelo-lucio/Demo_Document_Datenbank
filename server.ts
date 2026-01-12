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
        _id: "player_007",
        username: "IronTony",
        stats: { hp: 50, max_hp: 150, energy: 300 }, // HP Kritisch!
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