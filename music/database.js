// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
const firebase = require("firebase/app");
const auth = require("../auth.json");
const admin = require("./admin.js");
const ytdl = require("ytdl-core");
// Add the Firebase products that you want to use
require("firebase/firestore");

// Initialize Firebase
const firebaseConfig = auth.firebaseConfig;
const app = firebase.initializeApp(firebaseConfig);

let db = app.firestore();

function getQueue(gid, musicChannel) {
  const queuePath = "guilds/" + gid + "/VC/queue/songs";
  const path = "guilds/" + gid + "/VC";

  db.collection(queuePath).onSnapshot(async docs => {
    // Set up queue
    const prev = Object.assign([], admin.queue.get(gid)); // previous queue
    const queue = [];
    docs.forEach(doc => {
      queue.push(doc.data());
    });
    queue.sort((a, b) => a.pos - b.pos);
    admin.queue.set(gid, queue);
    try {
      // Set up voice channel
      let connection;
      if (admin.connection.has(gid)) {
        connection = admin.connection.get(gid);
      } else {
        connection = await musicChannel.join();
        admin.connection.set(gid, connection);
      }
      if (
        queue.length !== 0 &&
        (!admin.playing.has(gid) || !admin.playing.get(gid))
      ) {
        // If no playing value found or playing is false
        //set playing to true
        admin.playing.set(gid, true);
        play(gid, queue);
      } else if (
        connection.dispatcher &&
        queue.length !== 0 &&
        prev[0].uid !== queue[0].uid
      ) {
        // song changed
        if (queue[1] && prev[0].uid === queue[1].uid) {
          // user hit previous
          connection.dispatcher.end("prev");
        } else {
          connection.dispatcher.end("skip");
        }
        //set playing to true
        admin.playing.set(gid, true);
        play(gid, queue);
      }
    } catch (error) {
      admin.playing.set(gid, false);
      if (connection.dispatcher) {
        connection.dispatcher.end();
      }
      console.error(error);
    }
  });

  db.collection(path)
    .doc("controller")
    .onSnapshot(doc => {
      const controller = doc.data();
      admin.pauseState.set(gid, controller.pauseState);
      admin.loop.set(gid, controller.loop);
      admin.serverVolumes.set(gid, controller.volume);
      const connection = admin.connection.get(gid);
      if (connection && connection.dispatcher) {
        if (controller.pauseState) {
          connection.dispatcher.pause();
        } else {
          connection.dispatcher.resume();
        }
        setVolume(connection.dispatcher, gid);
      }
    });

  db.collection(path)
    .doc("history")
    .onSnapshot(doc => {
      if (doc.exists) {
        const history = doc.data().history;
        admin.history.set(gid, history);
      } else {
        admin.history.set(gid, []);
      }
    });
}
function setVolume(dispatcher, gid) {
  const vol = admin.serverVolumes.get(gid);
  dispatcher.setVolumeLogarithmic(vol / 30);
}
function updateQueue(gid, songs) {
  const path = "guilds/" + gid + "/VC/queue/songs";
  let batch = db.batch();
  let i = 0;
  songs.forEach(song => {
    song.pos = i;
    db.collection(path)
      .doc(song.uid)
      .set(song);
    i++;
  });
  batch.commit();
}

async function play(gid, queue) {
  if (queue.length === 0) {
    admin.playing.set(gid, false);
    updateQueue(gid, []);
    return;
  }
  const song = queue[0];
  // updateQueue(gid, queue);
  console.log("Now playing: " + song.title);
  const info = await ytdl.getBasicInfo(song.url);
  admin.duration.set(gid, info.length_seconds);
  const stream = await ytdl(song.url, { quality: "140", highWaterMark: 1 << 25 });
  const connection = admin.connection.get(gid);
  console.log("Starting stream, length: " + info.length_seconds);
  admin.time.set(gid, Date.now());
  try {
    const dispatcher = connection
      .playStream(stream)
      .on("end", reason => {
        const time = Date.now();
        const durPlayed = Math.floor((time - admin.time.get(gid)) / 1000);

        if (reason) console.log(reason);
        const queue = admin.queue.get(gid);
        console.log(song.title + " has ended");
        const loop = admin.loop.get(gid, false);
        admin.playing.set(gid, false);
        const path = "guilds/" + gid + "/VC/queue/songs";
        if (loop == 1 && reason !== "prev") {
          // looping the entire queue
          song.pos = queue.length - 1;
          queue.push(song);
        }
        if (reason !== "skip" && reason !== "prev") {
          db.collection(path)
            .doc(song.uid)
            .delete();
          console.log(durPlayed + "/" + admin.duration.get(gid));
          console.log(
            Math.floor((100 * durPlayed) / admin.duration.get(gid)) + "%"
          );

          if (loop != 2) {
            // not looping the current song
            queue.shift();
          }
          const history = admin.history.get(gid);
          history.unshift(song);
          updateHistory(gid, history);
          updateQueue(gid, queue);
        }
      })
      .on("error", error => {
        console.log(error);
        queue.shift();
        admin.playing.set(gid, false);
        updateQueue(gid, queue);
      });
    setVolume(dispatcher, gid);
  } catch (err) {
    console.error(err);
  }
}

function updateHistory(gid, songs) {
  const path = "guilds/" + gid + "/VC/";
  while (songs.length > 20) {
    songs.pop();
  }
  db.collection(path)
    .doc("history")
    .set({ history: songs });
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

module.exports = {
  pushUser: pushUser,
  pushController: pushController,
  popUser: popUser,
  getQueue: getQueue
};
