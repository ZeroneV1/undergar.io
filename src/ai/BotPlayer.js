var PlayerTracker = require("../PlayerTracker");
var Vec2 = require("../modules/Vec2");

function BotPlayer() {
  PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
  this.isBot = true;
  this.splitCooldown = 0;
  this.lastSplitTime = 0;
  this.escapeMode = false;
  this.escapeVector = null;
  this.threatAssessment = 0;
  this.foodGatheringTimer = 0;
  this.borderAwareness = true;
  this.lastBorderDistance = 0;

  // Only two possible personalities
  this.personality = Math.random() < 0.5 ? "AGGRESSIVE" : "DEFENSIVE";
  
  // All bots are at max skill
  this.skillLevel = 5;

  // Dynamic behavior parameters
  this.nextLogicTime = 0;
  this.nextSplitTime = 0;
  this.splitDelay = Math.random() * 1500 + 500; // 0.5-2s delay
  this.reactionTime = Math.random() * 40 + 10; // 10-50ms reaction delay
}

module.exports = BotPlayer;
BotPlayer.prototype = new PlayerTracker();

BotPlayer.prototype.largest = function (list) {
  var sorted = list.valueOf();
  sorted.sort(function (a, b) {
    return b._size - a._size;
  });
  return sorted[0];
};

BotPlayer.prototype.checkConnection = function () {
  if (this.socket.isCloseRequest) {
    while (this.cells.length) {
      this.gameServer.removeNode(this.cells[0]);
    }
    this.isRemoved = true;
    return;
  }
  if (!this.cells.length)
    this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
};

BotPlayer.prototype.sendUpdate = function () {
  if (this.splitCooldown) this.splitCooldown--;
  this.foodGatheringTimer = Math.max(0, this.foodGatheringTimer - 1);

  var cell = this.largest(this.cells);
  if (!cell) return;

  // Process decision with reaction delay
  if (Date.now() < this.nextLogicTime) return;
  this.nextLogicTime = Date.now() + this.reactionTime;

  this.decide(cell);
};

BotPlayer.prototype.hasVisiblePlayers = function() {
  for (var i = 0; i < this.viewNodes.length; i++) {
    if (this.viewNodes[i].cellType === 0 && this.viewNodes[i].owner !== this) {
      return true;
    }
  }
  return false;
};

BotPlayer.prototype.getBorderDistance = function(cell) {
  var borderX = this.gameServer.config.borderWidth / 2;
  var borderY = this.gameServer.config.borderHeight / 2;
  var distX = Math.min(borderX - Math.abs(cell.position.x), 
                      borderX - Math.abs(cell.position.y));
  var distY = Math.min(borderY - Math.abs(cell.position.x), 
                      borderY - Math.abs(cell.position.y));
  return Math.min(distX, distY);
};

BotPlayer.prototype.decide = function (cell) {
  // Clear escape mode if no immediate threats
  if (this.escapeMode && Date.now() - this.lastSplitTime > 2000) {
    this.escapeMode = false;
    this.escapeVector = null;
  }

  // Check if we're near border
  this.lastBorderDistance = this.getBorderDistance(cell);
  
  // If no players visible, focus on collecting mass
  if (!this.hasVisiblePlayers()) {
    this.collectMass(cell);
    return;
  }

  // Otherwise, proceed with normal attack/defense behavior
  this.threatAssessment = this.assessThreats(cell);

  // Escape behavior takes priority
  if (this.escapeMode) {
    this.handleEscape(cell);
    return;
  }

  // Personality-based attack/defense behavior
  if (this.personality === "AGGRESSIVE") {
    this.aggressiveBehavior(cell);
  } else {
    this.defensiveBehavior(cell);
  }
};

BotPlayer.prototype.collectMass = function(cell) {
  var bestTarget = null;
  var bestScore = -Infinity;
  
  // Check all visible nodes for food/viruses/ejected mass
  for (var i = 0; i < this.viewNodes.length; i++) {
    var check = this.viewNodes[i];
    if (check.owner === this) continue;
    
    var score = 0;
    var canEat = cell._size > check._size * 1.15;
    
    if (check.cellType === 1 && canEat) { // Food
      score = 1000 / (cell.position.sqDist(check.position) + 100);
    } 
    else if (check.cellType === 2 && canEat && this.cells.length < this.gameServer.config.playerMaxCells) { // Virus
      score = 1500 / (cell.position.sqDist(check.position) + 100);
    }
    else if (check.cellType === 3 && canEat) { // Ejected mass
      score = 800 / (cell.position.sqDist(check.position) + 100);
    }
    
    // Avoid going too close to borders
    var targetBorderDist = this.getBorderDistance(check);
    if (targetBorderDist < 100) {
      score *= 0.3; // Reduce score for targets near border
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestTarget = check;
    }
  }
  
  // If we found a good target, move toward it
  if (bestTarget) {
    this.mouse = bestTarget.position.clone();
  } 
  // Otherwise, move toward center if near border or wander
  else if (this.lastBorderDistance < 200) {
    this.mouse = new Vec2(0, 0); // Center of map
  } 
  else {
    this.wander(cell);
  }
};

BotPlayer.prototype.aggressiveBehavior = function(cell) {
  var target = null;
  var shouldSplit = false;
  
  // Find best target to attack
  for (var i = 0; i < this.viewNodes.length; i++) {
    var check = this.viewNodes[i];
    if (check.cellType !== 0 || check.owner === this) continue;
    
    // Can we eat this player with a split?
    if (cell._size / 2 > check._size * 1.15 && this.shouldSplitOffensive(cell, check)) {
      var dist = cell.position.sqDist(check.position);
      if (!target || dist < cell.position.sqDist(target.position)) {
        target = check;
        shouldSplit = true;
      }
    }
  }
  
  // Execute split attack if we found a good target
  if (shouldSplit && target && Date.now() > this.nextSplitTime && 
      this.cells.length < this.gameServer.config.playerMaxCells) {
    this.splitCooldown = 15;
    this.mouse = target.position.clone();
    this.socket.packetHandler.pressSpace = true;
    this.nextSplitTime = Date.now() + this.splitDelay;
    return;
  }
  
  // Otherwise move toward largest threat or food
  var result = new Vec2(0, 0);
  for (var i = 0; i < this.viewNodes.length; i++) {
    var check = this.viewNodes[i];
    if (check.owner === this) continue;
    
    var influence = 0;
    if (check.cellType === 0) { // Player cell
      if (cell._size > check._size * 1.15) {
        influence = check._size * 2.0;
      } else if (check._size > cell._size * 1.15) {
        influence = -check._size * 0.5;
      }
    } else if (check.cellType === 1) { // Food
      influence = 1;
    }
    
    if (influence !== 0) {
      var displacement = new Vec2(
        check.position.x - cell.position.x,
        check.position.y - cell.position.y
      ).normalize();
      result.add(displacement, influence);
    }
  }
  
  if (result.sqDist() > 0) {
    this.mouse = new Vec2(
      cell.position.x + result.x * 800,
      cell.position.y + result.y * 800
    );
  } else {
    this.wander(cell);
  }
};

BotPlayer.prototype.defensiveBehavior = function(cell) {
  var biggestThreat = null;
  var totalMass = this.getTotalMass();
  
  // Find biggest threat
  for (var i = 0; i < this.viewNodes.length; i++) {
    var check = this.viewNodes[i];
    if (check.cellType !== 0 || check.owner === this) continue;
    
    if (check._size > cell._size * 0.8) {
      if (!biggestThreat || check._size > biggestThreat._size) {
        biggestThreat = check;
      }
    }
  }
  
  // If there's a big threat, avoid it
  if (biggestThreat) {
    var escapeVec = new Vec2(
      cell.position.x - biggestThreat.position.x,
      cell.position.y - biggestThreat.position.y
    ).normalize();
    
    this.mouse = new Vec2(
      cell.position.x + escapeVec.x * 1000,
      cell.position.y + escapeVec.y * 1000
    );
    
    // Split to escape if needed
    if (biggestThreat._size > cell._size * 1.2 && 
        Date.now() > this.nextSplitTime && 
        this.splitCooldown === 0) {
      this.splitCooldown = 15;
      this.socket.packetHandler.pressSpace = true;
      this.nextSplitTime = Date.now() + this.splitDelay;
    }
    return;
  }
  
  // Otherwise collect mass but stay cautious
  this.collectMass(cell);
};

BotPlayer.prototype.assessThreats = function (cell) {
  var threatLevel = 0;
  var nearbyThreats = 0;

  for (var i = 0; i < this.viewNodes.length; i++) {
    var check = this.viewNodes[i];
    if (check.cellType !== 0 || check.owner === this) continue;

    var relativeSize = check._size / cell._size;
    if (relativeSize > 1.2) {
      nearbyThreats++;
      threatLevel += relativeSize;

      // Immediate danger detection
      var dist = cell.position.sqDist(check.position);
      if (dist < Math.pow(cell._size + check._size + 200, 2)) {
        threatLevel += 2.0;
      }
    }
  }

  if (nearbyThreats > 0) {
    threatLevel /= nearbyThreats;
  }
  
  return Math.min(threatLevel, 3.0);
};

BotPlayer.prototype.shouldSplitOffensive = function (cell, target) {
  if (this.splitCooldown > 0) return false;
  if (Date.now() < this.nextSplitTime) return false;
  if (this.cells.length >= this.gameServer.config.playerMaxCells) return false;

  // Distance check - only split if reasonably close
  var dist = cell.position.sqDist(target.position);
  var maxDist = 820 - cell._size / 2 - target._size;
  return dist <= maxDist * maxDist;
};

BotPlayer.prototype.wander = function (cell) {
  if (
    !this.wanderTarget ||
    Math.random() < 0.02 ||
    cell.position.sqDist(this.wanderTarget) < 2500
  ) {
    // Create new wander target (avoiding borders)
    var angle = Math.random() * Math.PI * 2;
    var distance = Math.random() * 300 + 200;
    var newTarget = new Vec2(
      cell.position.x + Math.cos(angle) * distance,
      cell.position.y + Math.sin(angle) * distance
    );
    
    // Adjust if too close to border
    var borderDist = this.getBorderDistance({position: newTarget});
    if (borderDist < 150) {
      // Push target away from border
      var centerVec = new Vec2(-newTarget.x, -newTarget.y).normalize();
      newTarget.add(centerVec, 200);
    }
    
    this.wanderTarget = newTarget;
  }
  this.mouse = this.wanderTarget.clone();
};

BotPlayer.prototype.getTotalMass = function () {
  var mass = 0;
  for (var i = 0; i < this.cells.length; i++) {
    mass += this.cells[i]._mass;
  }
  return mass;
};