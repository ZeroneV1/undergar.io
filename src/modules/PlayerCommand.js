var Logger = require('./Logger');
var UserRoleEnum = require("../enum/UserRoleEnum");
var Entity = require('../entity');
// PlayerCommand.js
var Commands = require('./CommandList'); // Correct relative path

function PlayerCommand(gameServer, playerTracker) {
    this.gameServer = gameServer;
    this.playerTracker = playerTracker;
}

function getName(name) {
    if (!name.length)
        name = "An unnamed cell";
    return name.trim();
}

module.exports = PlayerCommand;

PlayerCommand.prototype.writeLine = function (text) {
    this.gameServer.sendChatMessage(null, this.playerTracker, text);
};

PlayerCommand.prototype.executeCommandLine = function (commandLine) {
    if (!commandLine) return;

    // Splits the string
    var args = commandLine.split(" ");

    // Process the first string value
    var first = args[0].toLowerCase();

    // Get command function
    var execute = playerCommands[first];
    if (typeof execute != 'undefined') {
        execute.bind(this)(args);
    } else {
        this.writeLine("ERROR: Unknown command, type /help for command list");
    }
};


PlayerCommand.prototype.userLogin = function (ip, password) {
    if (!password) return null;
    password = password.trim();
    if (!password) return null;
    for (var i = 0; i < this.gameServer.userList.length; i++) {
        var user = this.gameServer.userList[i];
        if (user.password != password)
            continue;
        if (user.ip && user.ip != ip && user.ip != "*") // * - means any IP
            continue;
        return user;
    }
    return null;
};

var playerCommands = {
help: function (args) {
    this.writeLine("~~~~~~~~~~~~ COMMAND LIST ~~~~~~~~~~~~");

    let commandsPerRow = 3; // Number of columns per row
    let availableCommands = [];

    // Scan PlayerCommand.js for available commands dynamically
    for (let cmd in playerCommands) {
        let commandFunction = playerCommands[cmd].toString();

        // Check if the command has role-based restrictions
        if (!commandFunction.includes("this.playerTracker.userRole")) {
            availableCommands.push(cmd); // No role restriction, available to all users
        } else {
            // Check role restriction
            if (
                (this.playerTracker.userRole == UserRoleEnum.ADMIN && commandFunction.includes("UserRoleEnum.ADMIN")) ||
                (this.playerTracker.userRole == UserRoleEnum.MODER && commandFunction.includes("UserRoleEnum.MODER")) ||
                (this.playerTracker.userRole == UserRoleEnum.USER && commandFunction.includes("UserRoleEnum.USER"))
            ) {
                availableCommands.push(cmd);
            }
        }
    }

    // Find the longest command length
    let maxCommandLength = Math.max(...availableCommands.map(cmd => cmd.length));

    // Add padding to each command based on the longest command
    let paddedCommands = availableCommands.map(cmd => cmd.padEnd(maxCommandLength));

    // Print commands in a column format
    let row = "";
    for (let i = 0; i < paddedCommands.length; i++) {
        row += "/" + paddedCommands[i] + "| "; // Add each command with a separator

        // Break into a new row after 'commandsPerRow' commands
        if ((i + 1) % commandsPerRow === 0 || i === paddedCommands.length - 1) {
            this.writeLine(row.trim());
            row = ""; // Reset row for next line
        }
    }

    this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
},




    id: function (args) {
        this.writeLine("Your PlayerID is " + this.playerTracker.pID);
    },
    skin: function (args) {
        if (this.playerTracker.cells.length) {
            this.writeLine("ERROR: Cannot change skin while player in game!");
            return;
        }
        var skinName = "";
        if (args[1]) skinName = args[1];
        this.playerTracker.setSkin(skinName);
        if (skinName == "")
            this.writeLine("Your skin was removed");
        else
            this.writeLine("Your skin set to " + skinName);
    },


        die: function (args) {
        if (!this.playerTracker.cells.length) {
            this.writeLine("You cannot kill yourself, because you're still not joined to the game!");
            return;
        }
        while (this.playerTracker.cells.length) {
            var cell = this.playerTracker.cells[0];
            this.gameServer.removeNode(cell);
            // replace with food
            var food = require('../entity/Food');
            food = new food(this.gameServer, null, cell.position, cell._size);
            food.color = cell.color;
            this.gameServer.addNode(food);
        }
        this.writeLine("You commited die...");
            this.writeLine("RIP you...");
    },
    
            bc: function (args) {
           if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
       this.gameServer.sendChatMessage(null, null, "BROADCAST: "  + String(args.slice(1, args.length).join(" ")));
        },
    
    killall: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        var count = 0;
        var cell = this.playerTracker.cells[0];
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            var playerTracker = this.gameServer.clients[i].playerTracker;
            while (playerTracker.cells.length > 0) {
                this.gameServer.removeNode(playerTracker.cells[0]);
                count++;
            }
        }
        this.writeLine("You killed everyone. (" + count + (" cells.)"));
    },

mass: function (args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: Admin only!");
        return;
    }

    // Check if old format (ID first) was used accidentally
    if (args[2] && isNaN(args[1])) {
        this.writeLine("WARNING: Correct usage: /mass <mass> [ID|all]");
        return;
    }

    const mass = parseInt(args[1]);
    if (isNaN(mass) || mass <= 0) {
        this.writeLine("ERROR: Missing/invalid mass! Usage: /mass <mass> [ID|all]");
        return;
    }

    const size = Math.sqrt(mass * 100);
    const target = args[2]; // Optional: ID or "all"

    // Apply to self if no target
    if (!target) {
        for (const cell of this.playerTracker.cells) {
            cell.setSize(size);
        }
        this.writeLine(`Set YOUR mass to ${mass}`);
        return;
    }

    // Apply to all players
    if (target.toLowerCase() === "all") {
        let count = 0;
        for (const client of this.gameServer.clients) {
            for (const cell of client.playerTracker.cells) {
                cell.setSize(size);
            }
            count++;
        }
        this.writeLine(`Set mass to ${mass} for ALL players (${count} affected)`);
        return;
    }

    // Apply to specific player
    const id = parseInt(target);
    for (const client of this.gameServer.clients) {
        if (client.playerTracker.pID === id) {
            for (const cell of client.playerTracker.cells) {
                cell.setSize(size);
            }
            this.writeLine(`Set ${client.playerTracker._name}'s mass to ${mass}`);
            return;
        }
    }

    this.writeLine(`ERROR: Player ID ${id} not found!`);
},
    spawnmass: function (args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: Admin only!");
        return;
    }

    // Check if old format (ID first) was used accidentally
    if (args[2] && isNaN(args[1])) {
        this.writeLine("WARNING: Correct usage: /spawnmass <mass> [ID]");
        return;
    }

    const mass = parseInt(args[1]);
    if (isNaN(mass) || mass <= 0) {
        this.writeLine("ERROR: Missing/invalid mass! Usage: /spawnmass <mass> [ID]");
        return;
    }

    const size = Math.sqrt(mass * 100);
    const id = parseInt(args[2]);

    // Apply to self if no ID
    if (!args[2]) {
        this.playerTracker.spawnmass = size;
        this.writeLine(`Set YOUR spawn mass to ${mass}`);
        return;
    }

    // Apply to target player
    for (const client of this.gameServer.clients) {
        if (client.playerTracker.pID === id) {
            client.playerTracker.spawnmass = size;
            this.writeLine(`Set ${client.playerTracker._name}'s spawn mass to ${mass}`);
            return;
        }
    }

    this.writeLine(`ERROR: Player ID ${id} not found!`);
},
    
    
        pl: function(args) {
if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
this.writeLine("ERROR: access denied!");
return;
}
var clients = this.gameServer.clients;
clients.sort(function(a, b) { return a.playerTracker.pID - b.playerTracker.pID; });
for (var i = 0; i < clients.length; ++i) {
var client = clients[i].playerTracker;
var socket = clients[i];
var ip = client.isMi ? "[MINION]" : "BOT";
if (socket.isConnected && !client.isMi) {
ip = socket.remoteAddress;
}
var protocol = this.gameServer.clients[i].packetHandler.protocol;
if (!protocol) {
protocol = "?";
}
var data = "ID: " + client.pID + " - NICK: " + client._name + " - IP: " + ip;
this.writeLine(data);
}
},
    
    
    
 minion: function (args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: Admin only!");
        return;
    }

    // Check if old format (ID first) was used accidentally
    if (args[2] && isNaN(args[1])) {
        this.writeLine("WARNING: Correct usage: /minion <count> [ID]");
        return;
    }

    const count = parseInt(args[1]) || 1;
    const id = parseInt(args[2]);

    // Apply to self if no ID
    if (!args[2]) {
        this.playerTracker.minionControl = true;
        for (let i = 0; i < count; i++) {
            this.gameServer.bots.addMinion(this.playerTracker);
        }
        this.writeLine(`Added ${count} minion(s) to YOUR control`);
        return;
    }

    // Apply to target player
    for (const client of this.gameServer.clients) {
        if (client.playerTracker.pID === id) {
            client.playerTracker.minionControl = true;
            for (let i = 0; i < count; i++) {
                this.gameServer.bots.addMinion(client.playerTracker);
            }
            this.writeLine(`Added ${count} minion(s) to ${client.playerTracker._name}'s control`);
            return;
        }
    }

    this.writeLine(`ERROR: Player ID ${id} not found!`);
},
  
dm: function (args) {
    var player = this.playerTracker;

    // Check if the player has the necessary role
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: access denied!");
        return;
    }

    var id = args[1];
    var msg = args[2];

    if (id.length < 1) {
        this.writeLine("ERROR: missing id argument!");
        return;
    }

    if (msg.length < 1) {
        this.writeLine("ERROR: missing message argument!");
        return;
    }

    // Send the direct message
    this.gameServer.sendChatMessage(player, id, msg);
},

    
    addbot: function (args) {
        var add = parseInt(args[1]);
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        for (var i = 0; i < add; i++) {
            this.gameServer.bots.addBot();
        }
        Logger.warn(this.playerTracker.socket.remoteAddress + "ADDED " + add + " BOTS");
        this.writeLine("Added " + add + " Bots");
    },
    status: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN && this.playerTracker.userRole != UserRoleEnum.MODER) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        // Get amount of humans/bots
        var humans = 0,
            bots = 0;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            if ('_socket' in this.gameServer.clients[i]) {
                humans++;
            } else {
                bots++;
            }
        }
        var ini = require('./ini.js');
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        this.writeLine("Connected players: " + this.gameServer.clients.length + "/" + this.gameServer.config.serverMaxConnections);
        this.writeLine("Players: " + humans + " - Bots: " + bots);
        this.writeLine("Server has been running for " + Math.floor(process.uptime() / 60) + " minutes");
        this.writeLine("Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) / 10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) / 10 + " mb");
        this.writeLine("Current game mode: " + this.gameServer.gameMode.name);
        this.writeLine("Current update time: " + this.gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(this.gameServer.updateTimeAvg) + ")");
        this.writeLine("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    },
    login: function (args) {
        var password = args[1] + "";
        if (password.length < 1) {
            this.writeLine("ERROR: missing password argument!");
            return;
        }
        var user = this.userLogin(this.playerTracker.socket.remoteAddress, password);
        if (!user) {
            this.writeLine("ERROR: login failed!");
            return;
        }
        Logger.write("LOGIN        " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + user.name + "\"");
        this.playerTracker.userRole = user.role;
        this.playerTracker.userAuth = user.name;
        this.writeLine("Login done as \"" + user.name + "\"");
        return;
    },
    logout: function (args) {
        if (this.playerTracker.userRole == UserRoleEnum.GUEST) {
            this.writeLine("ERROR: not logged in");
            return;
        }
        Logger.write("LOGOUT       " + this.playerTracker.socket.remoteAddress + ":" + this.playerTracker.socket.remotePort + " as \"" + this.playerTracker.userAuth + "\"");
        this.playerTracker.userRole = UserRoleEnum.GUEST;
        this.playerTracker.userAuth = null;
        this.writeLine("Logout done");
    },
    shutdown: function (args) {
        if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: access denied!");
            return;
        }
        Logger.warn("SHUTDOWN REQUEST FROM " + this.playerTracker.socket.remoteAddress + " as " + this.playerTracker.userAuth);
        process.exit(0);
    },
    speed: function (args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: Admin only!");
        return;
    }

    // Check if old format (ID first) was used accidentally
    if (args[2] && isNaN(args[1])) {
        this.writeLine("WARNING: Correct usage: /speed <multiplier> [ID]");
        return;
    }

    const speed = parseFloat(args[1]);
    if (isNaN(speed) || speed <= 0) {
        this.writeLine("ERROR: Missing/invalid speed! Usage: /speed <multiplier> [ID]");
        return;
    }

    const id = parseInt(args[2]);

    // Apply to self if no ID
    if (!args[2]) {
        this.playerTracker.customspeed = speed;
        this.writeLine(`Set YOUR speed to ${speed}x`);
        return;
    }

    // Apply to target player
    for (const client of this.gameServer.clients) {
        if (client.playerTracker.pID === id) {
            client.playerTracker.customspeed = speed;
            this.writeLine(`Set ${client.playerTracker._name}'s speed to ${speed}x`);
            return;
        }
    }

    this.writeLine(`ERROR: Player ID ${id} not found!`);
},
    rainbow: function (args) {
        // Check if the player is an admin
        if (this.playerTracker.userRole !== UserRoleEnum.ADMIN) {
            this.writeLine("ERROR: You must be an admin to use this command!");
            return;
        }

        // Check if the player has cells
        if (this.playerTracker.cells.length === 0) {
            this.writeLine("You need to have at least one cell to use this command!");
            return;
        }

        // Rainbow effect duration (10 seconds)
        const duration = 10000; // 10 seconds in milliseconds
        const interval = 100; // Change color every 1 second
        let elapsedTime = 0;

        // Function to generate a random color
        const getRandomColor = () => {
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            return { r, g, b };
        };

        // Start the rainbow effect
        const rainbowInterval = setInterval(() => {
            // Generate a random color
            const newColor = getRandomColor();

            // Apply the color to all the player's cells
            for (const cell of this.playerTracker.cells) {
                cell.color = newColor;
            }

            // Update the elapsed time
            elapsedTime += interval;

            // Stop the effect after the duration is over
            if (elapsedTime >= duration) {
                clearInterval(rainbowInterval);
                this.writeLine("Rainbow effect ended!");
            }
        }, interval);

        this.writeLine("Rainbow effect started! Your cells will change colors for 10 seconds.");
    },

   split: function (args) {
    // Check if the user has the ADMIN role
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: access denied!");
        return;
    }

    // Check if the command has the correct number of arguments
    if (args.length < 2) {
        this.writeLine("ERROR: Please specify a player ID or 'all'!");
        return;
    }

    // Handle /split all command
    if (args[1].toLowerCase() === "all") {
        var count = 0;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            var client = this.gameServer.clients[i].playerTracker;
            if (client.pID >= 1 && client.pID <= 100 && client.cells.length) { // Only apply to IDs 1-100 with cells
                this.gameServer.splitCells(client);
                count++;
            }
        }
        if (count === 0) {
            this.writeLine("Warn: No players with IDs 1-100 found or all are dead!");
        } else {
            this.writeLine("Successfully split all players with IDs 1-100");
        }
        return;
    }

    // Parse the player ID
    var id = parseInt(args[1]);
    if (isNaN(id)) {
        this.writeLine("ERROR: Invalid player ID!");
        return;
    }

    // Find the player with the specified ID
    var targetPlayer = null;
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i].playerTracker;
        if (client.pID == id) {
            targetPlayer = client;
            break;
        }
    }

    // Check if the player was found
    if (!targetPlayer) {
        this.writeLine("ERROR: Player with ID " + id + " not found!");
        return;
    }

    // Check if the player has cells
    if (!targetPlayer.cells.length) {
        this.writeLine("ERROR: Player with ID " + id + " is either dead or not playing!");
        return;
    }

    // Split the player's cells
    this.gameServer.splitCells(targetPlayer);

    // Notify the admin that the command was successful
    this.writeLine("Successfully split player with ID " + id);
},
  freeze: function (args) {
    // Check if the user has the ADMIN role
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: access denied!");
        return;
    }

    // Check if the command has the correct number of arguments
    if (args.length < 2) {
        this.writeLine("ERROR: Please specify a player ID or 'all'!");
        return;
    }

    // Handle /freeze all command
    if (args[1].toLowerCase() === "all") {
        var count = 0;
        for (var i = 0; i < this.gameServer.clients.length; i++) {
            var client = this.gameServer.clients[i].playerTracker;
            if (client.pID >= 1 && client.pID <= 100) { // Only apply to IDs 1-100
                client.frozen = !client.frozen; // Toggle freeze state
                count++;
            }
        }
        if (count === 0) {
            this.writeLine("Warn: No players with IDs 1-100 found!");
        } else {
            this.writeLine("Successfully toggled freeze state for all players with IDs 1-100");
        }
        return;
    }

    // Parse the player ID
    var id = parseInt(args[1]);
    if (isNaN(id)) {
        this.writeLine("ERROR: Invalid player ID!");
        return;
    }

    // Find the player with the specified ID
    var targetPlayer = null;
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i].playerTracker;
        if (client.pID == id) {
            targetPlayer = client;
            break;
        }
    }

    // Check if the player was found
    if (!targetPlayer) {
        this.writeLine("ERROR: Player with ID " + id + " not found!");
        return;
    }

    // Toggle the frozen state
    targetPlayer.frozen = !targetPlayer.frozen;

    // Notify the admin
    this.writeLine("Player with ID " + id + " is now " + (targetPlayer.frozen ? "frozen" : "unfrozen"));
},
rebirth: function (args) {
    // Ensure Entity is defined
    if (typeof Entity === 'undefined') {
        console.error("Entity is not defined!");
        return;
    }

    // Check if the player is already in the process of rebirthing
    if (this.playerTracker.isRebirthing) {
        this.writeLine("You are already in the process of rebirthing!");
        return;
    }

    // Calculate the player's total mass
    let totalMass = 0;
    for (const cell of this.playerTracker.cells) {
        totalMass += cell._mass; // Sum up the mass of all cells
    }

    // Ensure the player has a valid mass
    if (totalMass <= 0) {
        this.writeLine("You don't have enough mass to rebirth.");
        return;
    }

    // Mark the player as rebirthing
    this.playerTracker.isRebirthing = true;

    // Notify the player that rebirth has started
    this.writeLine("Rebirth started! Hold on for 10 seconds...");

    // Start the 10-second delay
    const rebirthDelay = 10000; // 10 seconds in milliseconds

    setTimeout(() => {
        // Mark the player as no longer rebirthing
        this.playerTracker.isRebirthing = false;

        // Calculate the speed multiplier based on mass
        const speedMultiplier = 1 + (totalMass / 100000);

        // Update the player's custom speed by adding the new multiplier to the existing one
        if (!this.playerTracker.customspeed) {
            this.playerTracker.customspeed = 1; // Initialize if not set
        }
        this.playerTracker.customspeed += (speedMultiplier - 1); // Add the difference to accumulate

        // Override getSpeed function from PlayerCell
        Entity.PlayerCell.prototype.getSpeed = function (dist) {
            var speed = 2.2 * Math.pow(this._size, -0.439);
            speed = this.owner.customspeed ?
                speed * 40 * this.owner.customspeed : // Set by command
                speed * 40 * this.gameServer.config.playerSpeed;
            return Math.min(dist, speed) / dist;
        };

        // Kill all the player's cells (simulate rebirth)
        while (this.playerTracker.cells.length > 0) {
            const cell = this.playerTracker.cells[0];
            this.gameServer.removeNode(cell);
        }

        // Notify the player of the new speed multiplier
        this.writeLine(`You have rebirthed! Your speed multiplier is now ${this.playerTracker.customspeed.toFixed(4)}.`);
    }, rebirthDelay);
},
explode: function (args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN) {
        this.writeLine("ERROR: Admin only!");
        return;
    }

    // Handle /explode all
    if (args[1] && args[1].toLowerCase() === "all") {
        let explodedCount = 0;
        for (const client of this.gameServer.clients) {
            if (client.playerTracker.cells.length > 0) {
                // Explode each cell
                for (const cell of client.playerTracker.cells) {
                    while (cell._size > this.gameServer.config.playerMinSize) {
                        const angle = 6.28 * Math.random();
                        const loss = this.gameServer.config.ejectSizeLoss;
                        const size = cell.radius - loss * loss;
                        cell.setSize(Math.sqrt(size));

                        // Create ejected mass
                        const pos = {
                            x: cell.position.x + angle,
                            y: cell.position.y + angle
                        };
                        const ejected = new Entity.EjectedMass(this.gameServer, null, pos, this.gameServer.config.ejectSize);
                        ejected.color = cell.color;
                        ejected.setBoost(this.gameServer.config.ejectVelocity * Math.random(), angle);
                        this.gameServer.addNode(ejected);
                    }
                    cell.setSize(this.gameServer.config.playerMinSize);
                }
                explodedCount++;
            }
        }
        this.writeLine(`Success: Exploded all players (${explodedCount} affected)`);
        return;
    }

    // If no args, explode self
    if (!args[1]) {
        const client = this.playerTracker;
        if (client.cells.length === 0) {
            this.writeLine("ERROR: You have no cells to explode!");
            return;
        }

        for (const cell of client.cells) {
            while (cell._size > this.gameServer.config.playerMinSize) {
                const angle = 6.28 * Math.random();
                const loss = this.gameServer.config.ejectSizeLoss;
                const size = cell.radius - loss * loss;
                cell.setSize(Math.sqrt(size));

                const pos = {
                    x: cell.position.x + angle,
                    y: cell.position.y + angle
                };
                const ejected = new Entity.EjectedMass(this.gameServer, null, pos, this.gameServer.config.ejectSize);
                ejected.color = cell.color;
                ejected.setBoost(this.gameServer.config.ejectVelocity * Math.random(), angle);
                this.gameServer.addNode(ejected);
            }
            cell.setSize(this.gameServer.config.playerMinSize);
        }
        this.writeLine("Success: Your cells have been exploded!");
        return;
    }

    // Handle specific player ID
    const id = parseInt(args[1]);
    if (isNaN(id)) {
        this.writeLine("ERROR: Invalid input! Usage: /explode [all|ID]");
        return;
    }

    for (const client of this.gameServer.clients) {
        if (client.playerTracker.pID === id) {
            if (client.playerTracker.cells.length === 0) {
                this.writeLine(`ERROR: Player ${id} has no cells to explode!`);
                return;
            }

            for (const cell of client.playerTracker.cells) {
                while (cell._size > this.gameServer.config.playerMinSize) {
                    const angle = 6.28 * Math.random();
                    const loss = this.gameServer.config.ejectSizeLoss;
                    const size = cell.radius - loss * loss;
                    cell.setSize(Math.sqrt(size));

                    const pos = {
                        x: cell.position.x + angle,
                        y: cell.position.y + angle
                    };
                    const ejected = new Entity.EjectedMass(this.gameServer, null, pos, this.gameServer.config.ejectSize);
                    ejected.color = cell.color;
                    ejected.setBoost(this.gameServer.config.ejectVelocity * Math.random(), angle);
                    this.gameServer.addNode(ejected);
                }
                cell.setSize(this.gameServer.config.playerMinSize);
            }
            this.writeLine(`Success: Exploded ${client.playerTracker._name}'s cells!`);
            return;
        }
    }

    this.writeLine(`ERROR: Player ID ${id} not found!`);
},
  botlist: function(args) {
    if (this.playerTracker.userRole != UserRoleEnum.ADMIN && 
        this.playerTracker.userRole != UserRoleEnum.MODER) {
        this.writeLine("ERROR: access denied!");
        return;
    }

    // Get all bot players using two detection methods:
    const bots = this.gameServer.clients.filter(client => {
        // Method 1: Check isBot flag
        if (client.playerTracker.isBot) return true;
        
        // Method 2: Check for FakeSocket (backup detection)
        if (client.constructor.name === 'FakeSocket') return true;
        
        return false;
    });

    if (bots.length === 0) {
        this.writeLine("No bots currently connected (or detection failed)");
        return;
    }

    // Format the output
    bots.forEach(bot => {
        const botInfo = bot.playerTracker;
        let personality = botInfo.personality || "UNKNOWN";
        let skill = botInfo.skillLevel || "?";
        
        this.writeLine(`ID:${botInfo.pID} lvl:${skill} type:${personality}`);
    });

    this.writeLine(`Total bots: ${bots.length}`);
    this.writeLine(`Total players: ${this.gameServer.clients.length}`);
}
    // Other commands...
};
