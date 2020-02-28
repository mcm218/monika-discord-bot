// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
const firebase = require("firebase/app");
const auth = require("../auth.json");
const admin = require("./admin.js");
const ytdl = require("ytdl-core");
const fs = require("fs");
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
      admin.loop.set(gid, controller.loop);
      admin.serverVolumes.set(gid, controller.volume);
      const connection = admin.connection.get(gid);
      if (connection && connection.dispatcher) {
        if (controller.pauseState) {
          console.log("Pause");
          if (
            admin.pauseState.has(gid) &&
            admin.pauseState.get(gid) != controller.pauseState
          ) {
            updatePauseTime(gid, Date.now());
          }
          connection.dispatcher.pause();
        } else {
          console.log("Play");
          if (
            admin.pauseState.has(gid) &&
            admin.pauseState.get(gid) != controller.pauseState
          ) {
            updateResumeTime(gid, Date.now());
          }
          connection.dispatcher.resume();
        }
        admin.pauseState.set(gid, controller.pauseState);
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
  dispatcher.setVolumeLogarithmic(vol / 60);
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

function updateTime(gid, start, duration) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set(
      { startTime: start, duration: duration, pauseTime: -1, resumeTime: -1 },
      { merge: true }
    );
}
function updatePauseTime(gid, pause) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set({ pauseTime: pause, resumeTime: -1 }, { merge: true });
}
function updateResumeTime(gid, resume) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set({ resumeTime: resume }, { merge: true });
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
  try {
    const info = await ytdl.getBasicInfo(song.url);
    admin.duration.set(gid, info.length_seconds);
    const stream = await ytdl(song.url, {
      quality: "18"
      // highWaterMark: 1 << 25
    }).on("response", response => console.log("Response received"));
    const dlStart = Date.now();
    stream.pipe(fs.createWriteStream("music/song_" + gid));
    stream.on("end", () => {
      const dlEnd = Date.now();
      const dlDuration = Math.floor((dlEnd - dlStart) / 1000);
      console.log("Download Time: " + dlDuration);
      const connection = admin.connection.get(gid);
      var dlTimeStr =
        "Starting stream, length - " +
        Math.floor(info.length_seconds / 60) +
        ":";
      if (info.length_seconds % 60 < 10) {
        let sec = "0" + (info.length_seconds % 60);
        dlTimeStr += sec;
      } else {
        dlTimeStr += info.length_seconds % 60;
      }
      console.log(dlTimeStr);

      const dispatcher = connection
        .playFile(__dirname + "/song_" + gid)
        .on("start", () => {
          console.log("Starting song...");
          const now = Date.now();
          admin.time.set(gid, now);
          updateTime(gid, now, info.length_seconds);
          setVolume(dispatcher, gid);
        })
        .on("end", reason => {
          const time = Date.now();
          const durPlayed = Math.ceil((time - admin.time.get(gid)) / 1000);

          if (reason) console.log(reason);
          const queue = admin.queue.get(gid);
          console.log(song.title + " has ended");
          const loop = admin.loop.get(gid);
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
              const history = admin.history.get(gid);
              history.unshift(song);
              updateHistory(gid, history);
            } else {
              console.log("Looping song...");
              console.log(queue[0].title);
            }
            updateQueue(gid, queue);
          }
        })
        .on("error", error => {
          console.error(error);
          queue.shift();
          admin.playing.set(gid, false);
          updateQueue(gid, queue);
        });
      if (admin.pauseState.get(gid)) {
        console.log("Pause");
        dispatcher.pause();
      }
    });
  } catch (err) {
    console.error(err);
    queue.shift();
    admin.playing.set(gid, false);
    updateQueue(gid, queue);
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
