// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");
const auth = require("../auth.json");
const admin = require("./admin.js")
const ytdl = require('ytdl-core');
// Add the Firebase products that you want to use
require("firebase/firestore");

// Initialize Firebase
const firebaseConfig = auth.firebaseConfig;
const app = firebase.initializeApp(firebaseConfig);

let db = app.firestore();

function getQueue(gid, musicChannel) {
  const path = "guilds/" + gid + "/VC/queue/songs"
  db.collection(path).onSnapshot(async (docs) => {
    // Set up queue
    const queue = [];
    docs.forEach((doc) => {
      queue.push(doc.data());
    });
    queue.sort((a, b) => a.pos - b.pos);
    admin.queue.set(gid, queue);
    // Set up voice channel
    var connection;
    if (admin.connection.has(gid)) {
      connection = admin.connection.get(gid);
    } else {
      connection = await musicChannel.join();
      admin.connection.set(gid, connection);
    }
    // If no playing value found or playing is false
    if (queue.length != 0 && (!admin.playing.has(gid) || !admin.playing.get(gid))) {
      play(gid, queue);
    }
  });
}

function updateQueue(gid, songs) {
  const path = "guilds/" + gid + "/VC/queue/songs";
  const pos = songs.length;
  let batch = db.batch();
  db.collection(path)
    .doc(pos.toString())
    .delete();
  let i = 0;
  songs.forEach((song) => {
    song.pos = i;
    db.collection(path)
      .doc(i.toString())
      .set(song);
    i++;
  });
  batch.commit();
}

async function play(gid, queue) {
  if (queue.length == 0) {
    updateQueue(gid, []);
    return;
  }
  admin.playing.set(gid, true);
  updateQueue(gid, queue);
  console.log("Now playing: " + queue[0].title)
  const info = await ytdl.getBasicInfo(queue[0].url);
  admin.duration.set(gid, info.length_seconds);
  const stream = await ytdl(queue[0].url);
  const connection = admin.connection.get(gid);
  console.log("Starting stream, length: " + info.length_seconds);
  admin.time.set(gid, Date.now());

  const dispatcher = connection.playStream(stream).on("end", () => {
    const queue = admin.queue.get(gid);
    console.log(queue[0].title + " has ended");
    const time = Date.now();
    const durPlayed = Math.floor((time - admin.time.get(gid)) / 1000);
    console.log(durPlayed + "/" + admin.duration.get(gid));
    console.log((100 * durPlayed / admin.duration.get(gid)) + "%");
    admin.playing.set(gid, false);
    queue.shift();
    play(gid, queue);
  }).on("error", error => {
    console.log(error);
    play(gid, queue);
  });
  dispatcher.setVolumeLogarithmic(1);
}


function pushSearch(playlist, search, results) {
  var path;
  if (playlist) {
    path = "searches/playlists/" + search;
  } else {
    path = "searches/videos/" + search;
  }
  for (let i = 0; i < results.length; i++) {
    db.collection(path)
      .doc(i.toString())
      .set(results[i]);
  }
}
async function getSearchList(playlist, search) {
  var docs;
  if (playlist) {
    await db
      .collection("searches/playlists/" + search)
      .get()
      .then((snapshots) => {
        docs = snapshots.docs;
      });
  } else {
    await db
      .collection("searches/videos/" + search)
      .get()
      .then((snapshots) => {
        docs = snapshots.docs;
      });
  }
  return docs;
}

async function getSearchSingle(playlist, search) {
  var id;
  if (playlist) {
    await db
      .collection("searches/playlists/" + search)
      .get()
      .then((snapshots) => {
        if (snapshots.docs[0]) id = snapshots.docs[0].data().id.videoId;
      });
  } else {
    await db
      .collection("searches/videos/" + search)
      .get()
      .then((snapshots) => {
        if (snapshots.docs[0]) id = snapshots.docs[0].data().id.videoId;
      });
  }
  return id;
}

function pushQueue(gid, songs) {
  console.log("Updating queue: ");
  console.log(songs);
  const path = "guilds/" + gid + "/VC/queue/songs";
  let i = 0;
  let batch = db.batch();
  songs.forEach((song) => {
    song.pos = i;
    db.collection(path)
      .doc(i.toString())
      .set(song);
    i++;
  });
  batch.commit();
}

function removeLast(gid, pos) {
  const path = "guilds/" + gid + "/VC/queue/songs";
  console.log("Removing " + pos);
  db.collection(path)
    .doc(pos.toString())
    .delete();
}
function pushUser(gid, user) {
  db.collection("guilds/" + gid + "/VC")
    .doc(user.id)
    .set({
      avatar: user.user.avatar,
      id: user.user.id,
      username: user.user.username,
      muted: user.selfMute,
      deaf: user.selfDeaf
    });
}
function pushController(gid, controller) {
  db.collection("guilds/" + gid + "/VC")
    .doc("controller")
    .set(controller, { merge: true });
}
function popUser(gid, id) {
  db.collection("guilds/" + gid + "/VC")
    .doc(id)
    .delete();
}
function getQueueRef(gid) {
  return db.collection("guilds/" + gid + "/VC/queue/songs");
}
function getControllerRef(gid) {
  return db.collection("guilds/" + gid + "/VC/").doc("controller");
}

module.exports = {
  pushSearch: pushSearch,
  getSearchList: getSearchList,
  getSearchSingle: getSearchSingle,
  pushQueue: pushQueue,
  pushUser: pushUser,
  pushController: pushController,
  popUser: popUser,
  getQueueRef: getQueueRef,
  getControllerRef: getControllerRef,
  removeLast: removeLast,
  getQueue: getQueue
};
