// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");
var auth = require("../auth.json");
// Add the Firebase products that you want to use
require("firebase/firestore");

// Initialize Firebase
var firebaseConfig = auth.firebaseConfig;
firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();

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
function updateQueue(gid, songs) {
  console.log("Updating queue ");
  const path = "guilds/" + gid + "/VC/queue/songs";
  const pos = songs.length;
  db.collection(path)
    .doc(pos.toString())
    .delete();
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
  updateQueue: updateQueue
};
