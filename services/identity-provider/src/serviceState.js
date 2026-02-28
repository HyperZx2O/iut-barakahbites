let serviceAlive = true;

function isAlive() {
  return serviceAlive;
}

function kill() {
  serviceAlive = false;
}

function revive() {
  serviceAlive = true;
}

module.exports = { isAlive, kill, revive };
