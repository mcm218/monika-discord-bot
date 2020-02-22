const queueObservers = new Map();
const queue = new Map();
const connection = new Map();
const playing = new Map();
const controllerObservers = new Map();
var searchList = new Map();
const loop = new Map();
// 0 - no looping
// 1 - queue looping
// 2 - song looping
const pauseState = new Map();
var serverVolumes = new Map();
const youtubeKey = [];
const shuffleMode = new Map();

module.exports = {
  queue,
  queueObservers,
  controllerObservers,
  searchList,
  loop,
  shuffleMode,
  pauseState,
  serverVolumes,
  youtubeKey,
  connection
};
