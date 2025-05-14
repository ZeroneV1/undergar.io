// Imports
var BinaryWriter = require("./BinaryWriter");

function UpdateLeaderboard(playerTracker, leaderboard, leaderboardType) {
    this.playerTracker = playerTracker;
    this.leaderboard = leaderboard;
    this.leaderboardType = leaderboardType;
    this.leaderboardCount = Math.min(leaderboard.length, playerTracker.gameServer.config.serverMaxLB);
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function(protocol) {
    switch (this.leaderboardType) {
        case 48:
            if (protocol < 11) return this.buildUserText(protocol);
            else return this.buildUserText14();
        case 49:
            if      (protocol < 6 ) return this.buildFfa5();
            else if (protocol < 11) return this.buildFfa6();
            else                    return this.buildFfa(protocol);
        case 50:
            return this.buildTeam();
        default:
            return null;
    }
};

// Format leaderboard to adjust size dynamically
UpdateLeaderboard.prototype.formatLeaderboard = function () {
    let formattedLeaderboard = [];
    let maxLen = 0;

    // First pass: Determine max length
    for (let i = 0; i < this.leaderboard.length; i++) {
        let playerTracker = this.leaderboard[i];
        if (!playerTracker || typeof playerTracker.pID === "undefined") continue;

        let displayName = `Id:${playerTracker.pID} | ${playerTracker._name || "Unnamed"}`;
        maxLen = Math.max(maxLen, displayName.length);
    }

    // Cap the max length at 20
    maxLen = Math.min(maxLen, 20);

    // Second pass: Format leaderboard with adjusted lengths
    for (let i = 0; i < this.leaderboard.length; i++) {
        let playerTracker = this.leaderboard[i];
        if (!playerTracker || typeof playerTracker.pID === "undefined") continue;

        let displayName = `Id:${playerTracker.pID} | ${playerTracker._name || "Unnamed"}`;

        // Adjust length: Trim if too long, pad if too short
        if (displayName.length > maxLen) {
            displayName = displayName.substring(0, maxLen);
        } else {
            displayName = displayName.padEnd(maxLen);
        }

        formattedLeaderboard.push(displayName);
    }

    return formattedLeaderboard;
};

// User text all other protocols
UpdateLeaderboard.prototype.buildUserText = function(protocol) {
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboard.length);
    let formattedLeaderboard = this.formatLeaderboard();

    for (var i = 0; i < formattedLeaderboard.length; i++) {
        var item = formattedLeaderboard[i] || "";
        if (protocol < 11) writer.writeUInt32(0);
        if (protocol < 6) writer.writeStringZeroUnicode(item);
        else writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};

// User text 14
UpdateLeaderboard.prototype.buildUserText14 = function () {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x35);
    let formattedLeaderboard = this.formatLeaderboard();

    for (var i = 0; i < formattedLeaderboard.length; i++) {
        var item = formattedLeaderboard[i] || "";
        writer.writeUInt8(0x02);
        writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};

// FFA protocol 5
UpdateLeaderboard.prototype.buildFfa5 = function() {
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboardCount);
    let formattedLeaderboard = this.formatLeaderboard();

    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = formattedLeaderboard[i];
        if (!item) return null;
        writer.writeUInt32(0);
        writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};

// FFA protocol 6
UpdateLeaderboard.prototype.buildFfa6 = function() {
    var writer = new BinaryWriter();
    writeCount(writer, 0x31, this.leaderboardCount);
    let formattedLeaderboard = this.formatLeaderboard();

    for (var i = 0; i < this.leaderboardCount; i++) {
        var item = formattedLeaderboard[i];
        if (!item) return null;
        writer.writeUInt32(0);
        writer.writeStringZeroUtf8(item);
    }
    return writer.toBuffer();
};

// FFA protocol 13/14
UpdateLeaderboard.prototype.buildFfa = function(protocol) {
    var writer = new BinaryWriter();
    if   (protocol < 14) writer.writeUInt8(0x33); // 13
    else                 writer.writeUInt8(0x35); // 14
    let formattedLeaderboard = this.formatLeaderboard();

    for (var i = 0; i < formattedLeaderboard.length; i++) {
        writer.writeUInt8(0x02);
        writer.writeStringZeroUtf8(formattedLeaderboard[i]);
    }

    return writer.toBuffer();
};

// Party Mode (Placeholder)
UpdateLeaderboard.prototype.buildParty = function() {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x34);
    writer.writeUInt16(0);
    return writer.toBuffer();
};

// Helper function for writing leaderboard count
function writeCount(writer, flag1, flag2) {
    writer.writeUInt8(flag1);
    writer.writeUInt32(flag2 >>> 0);
}

// Team Mode Leaderboard
UpdateLeaderboard.prototype.buildTeam = function () {
    var writer = new BinaryWriter();
    writeCount(writer, 0x32, this.leaderboard.length);
    for (var i = 0; i < this.leaderboard.length; i++) {
        var value = this.leaderboard[i];
        if (!value) return null;
        writer.writeFloat(Math.max(0, Math.min(1, value)));
    }
    return writer.toBuffer();
};
