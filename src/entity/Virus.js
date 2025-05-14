var Cell = require('./Cell');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    this.cellType = 2;
    this.isSpiked = true;
    this.isMotherCell = false; // Not to confuse bots
    this.color = {
        r: 0x33,
        g: 0xff,
        b: 0x33
    };
}

module.exports = Virus;
Virus.prototype = new Cell();

// Main Functions

Virus.prototype.canEat = function(cell) {
    // cannot eat if virusMaxAmount is reached
    if (this.gameServer.nodesVirus.length < this.gameServer.config.virusMaxAmount)
        return cell.cellType == 3; // virus can eat ejected mass only
};

Virus.prototype.onEat = function(prey) {
    // Called to eat prey cell
    this.setSize(Math.sqrt(this.radius + prey.radius));

    if (this._size >= this.gameServer.config.virusMaxSize) {
        this.setSize(this.gameServer.config.virusMinSize); // Reset mass
        this.gameServer.shootVirus(this, prey.boostDirection.angle());
    }
};

Virus.prototype.onEaten = function(cell) {
    if (!cell.owner) return;
    var config = this.gameServer.config;

    var cellsLeft = (config.virusMaxCells || config.playerMaxCells) - cell.owner.cells.length;
    if (cellsLeft <= 0) return;

    var splitMin = config.virusMaxPoppedSize * config.virusMaxPoppedSize / 100;
    var cellMass = cell._mass, splits = [], splitCount, splitMass;

    // Max split mass (example: if mass > 460, limit the mass to split)
    var maxSplitMass = 460; // Set a max mass threshold for splitting
    if (cellMass > maxSplitMass) {
        cellMass = maxSplitMass; // Only use up to max split mass
    }

    // Max split cells (example: limit number of splits to 10)
    var maxSplitCells = 10; // Maximum number of split cells
    splitCount = Math.min(Math.floor(cellMass / splitMin), cellsLeft, maxSplitCells);

    splitMass = cellMass / splitCount;
    for (var i = 0; i < splitCount; i++) {
        splits.push(splitMass);
    }

    this.explodeCell(cell, splits);
};

Virus.prototype.explodeCell = function(cell, splits) {
    for (var i = 0; i < splits.length; i++)
        this.gameServer.splitPlayerCell(cell.owner, cell, 2 * Math.PI * Math.random(), splits[i]);
};

Virus.prototype.onAdd = function(gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1)
        gameServer.nodesVirus.splice(index, 1);
};
