// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
const admin = require("./admin.js");

const ytdl = require("ytdl-core");
const fs = require("fs");
const auth = require("../auth.json");
const firebase = require("firebase/app");
const firebaseConfig = auth.firebaseConfig;
firebase.initializeApp(firebaseConfig);
require("firebase/auth");
require("firebase/functions");
require("firebase/firestore");
const validURL = require("../validUrl");

const fbAuth = firebase.auth();
const fbFunctions = firebase.functions();
const db = firebase.firestore();

const YouTube = require("discord-youtube-api");
const youtube = new YouTube(auth.youtubeKey);


async function authBot(id) {
  console.log("Creating custom token...");
  let res = await fbFunctions.httpsCallable("getUserToken")({ userId: id, bot: true });
  console.log("Signing user in...");
  await fbAuth.signInWithCustomToken(res.data.customToken);
  return;
}

// Called when the Bot first starts, sets up listeners for the database
function getQueue(gid, musicChannel) {
  const queuePath = "guilds/" + gid + "/VC/queue/songs";
  const path = "guilds/" + gid + "/VC";
  // Listener called whenever a change in the queue is detected
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
      // Set up music channel
      let connection;
      if (admin.connection.has(gid)) {
        connection = admin.connection.get(gid);
      } else if (queue && queue.length > 0) {
        console.log("Joining VC");
        try{
          connection = await musicChannel.join();
        }catch(e){
          console.log("Error joining VC");
          console.log(e);
          return;
        }
        admin.connection.set(gid, connection);
      } else {
        return;
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
      } else if (!queue || queue.length == 0) {
        console.log("Leaving VC");
        musicChannel.leave();
        admin.connection.delete(gid);
      }
    } catch (error) {
      admin.playing.set(gid, false);
      if (connection.dispatcher) {
        connection.dispatcher.end();
      }
      console.error(error);
    }
  });
  // Sets up listener for the controller (play/pause, volume, loop)
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
  // Sets up Listener for history
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
// Sets the Volume of the Dispatcher
function setVolume(dispatcher, gid) {
  const vol = admin.serverVolumes.get(gid);
  dispatcher.setVolumeLogarithmic(vol / 20);
}
// Updates queue in Database
function updateQueue(gid, songs) {
  const path = "guilds/" + gid + "/VC/queue/songs";
  let batch = db.batch();
  let i = 0;
  songs.forEach(song => {
    song.pos = i;
    song.dateUpdated = Date.now();
    try {
      db.collection(path)
        .doc(song.uid)
        .set(song);
    } catch (error) {
      console.error(error);
    }
    i++;
  });
  batch.commit();
}

async function removeSong(gid, index, message){
  let queue = admin.queue.get(gid);
  if(!queue || queue.length == 0){
    message.channel.send("No songs in the queue...");
    return;
  }
  if(index == 1){
    let connection = admin.connection.get(gid);
    connection.dispatcher.end("");
  }else{
    const path = "guilds/" + gid + "/VC/queue/songs";
    const song = queue.splice(index - 1, 1)[0];
    db.collection(path).doc(song.uid).delete();
    message.channel.send("Removed " + song.title);
  }
}

async function addSong(gid, search, message){
  // Search for song
  const video = await youtube.searchVideos(search)
  message.channel.send("Added " + video.title);
  // Add first result to Queue
  let queue = admin.queue.get(gid);
  const song = {
    "date": new Date().toString(),
    "id": video.id,
    "uid": Date.now().toString(),
    "source": "youtube",
    "thumbnail": video.thumbnail,
    "title": video.title,
    "url": video.url,
    "user": {
      "username": message.author.username,
      "id": message.author.id,
      "avatar": message.author.avatar
    },
    "youtubeTitle": video.title
  };
  queue.push(song);
  // Update queue
  updateQueue(gid, queue);
}

async function addSongFromUrl(gid, url, message){
  // Search for song
  const video = await youtube.getVideo(url)
  message.channel.send("Added " + video.title);
  // Add first result to Queue
  let queue = admin.queue.get(gid);
  const song = {
    "date": new Date().toString(),
    "id": video.id,
    "uid": Date.now().toString(),
    "source": "youtube",
    "thumbnail": video.thumbnail,
    "title": video.title,
    "url": video.url,
    "user": {
      "username": message.author.username,
      "id": message.author.id,
      "avatar": message.author.avatar
    },
    "youtubeTitle": video.title
  };
  queue.push(song);
  // Update queue
  updateQueue(gid, queue);
}

async function shiftSong(gid, index, message){
  let queue = admin.queue.get(gid);
  if(!queue || queue.length == 0){
    message.channel.send("No songs in the queue...");
    return;
  }
  if(index < 1){
    message.channel.send("Invalid index :<")
  }
  if(index == 1 || index == 2){
    return;
  }
  const path = "guilds/" + gid + "/VC/queue/songs";
  const song = queue.splice(index - 1, 1)[0];
  queue.splice(1, 0, song);
  updateQueue(gid, queue);
}

async function shuffleQueue(gid, message){
  let queue = admin.queue.get(gid);
  for(let i = queue.length - 1; i > 1; i--){
    const j = Math.floor(Math.random() * (i - 1)) + 1;
    const temp = queue.splice(i, 1)[0];
    queue[i] = queue[j];
    queue[j] = temp;
  }
  updateQueue(gid, queue);

}
// Updates database controller with the start time of the song
function updateTime(gid, start, duration) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set(
      { startTime: start, duration: duration, pauseTime: -1, resumeTime: -1 },
      { merge: true }
    );
}
// Updates database controller with the pause time
function updatePauseTime(gid, pause) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set({ pauseTime: pause, resumeTime: -1 }, { merge: true });
}
// Updates database controller with the resume time
function updateResumeTime(gid, resume) {
  const path = "guilds/" + gid + "/VC";
  db.collection(path)
    .doc("controller")
    .set({ resumeTime: resume }, { merge: true });
}
// Downloads song to file, then plays it
async function play(gid, queue) {
  if (queue.length === 0) {
    console.log("Leaving VC");

    const musicChannel = admin.musicChannel.get(gid);
    musicChannel.leave();
    admin.connection.delete(gid);
    admin.playing.set(gid, false);
    updateQueue(gid, []);
    return;
  }
  const song = queue[0];
  if(song == null || song.url == null){
    console.error("Tried to play undefined song object...");
    return;
  }
  if(!validURL.validURL(song.url)){
    console.error("Tried to play invalid song object...");
    return;
  }
  console.log("Now playing: " + song.title);
  try {
    const info = await ytdl.getBasicInfo(song.url);
    admin.duration.set(gid, info.length_seconds);
    const stream = await ytdl(song.url, {
      quality: "18"
      // highWaterMark: 1 << 25
    }).on("response", response => console.log("Response received"));
    const dlStart = Date.now();
    stream.pipe(fs.createWriteStream("music/song_" + song.id));
    // Once download finishes, set up Discord stream
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
      // If something has happened to the connection, exit
      if (!connection) {
        queue.shift();
        admin.playing.set(gid, false);
        updateQueue(gid, []);
        return;
      }
      const dispatcher = connection
        .playFile(__dirname + "/song_" + song.id)
        .on("start", () => {
          console.log("Starting song...");
          const now = Date.now();
          admin.time.set(gid, now);
          updateTime(gid, now, info.length_seconds);
          setVolume(dispatcher, gid);
        })
        .on("end", reason => {
          updateTime(gid, -1, -1);
          fs.unlink("music/song_" + song.id, () => {
            console.log("Deleted old song file...");
          });
          const time = Date.now();
          const durPlayed = Math.ceil((time - admin.time.get(gid)) / 1000);

          if (reason) console.log(reason);
          const queue = Object.assign([], admin.queue.get(gid));
          console.log(song.title + " has ended");
          const loop = admin.loop.get(gid);
          const path = "guilds/" + gid + "/VC/queue/songs";
          if (loop == 1 && reason !== "prev") {
            // looping the entire queue
            song.pos = queue.length - 1;
            queue.push(song);
          }
          if (reason !== "skip" && reason !== "prev") {
            if (loop == 0) {
              db.collection(path)
                .doc(song.uid)
                .delete();
            }
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
            admin.playing.set(gid, false);
          }
        })
        .on("error", error => {
          console.log("ERROR PLAYING FILE: \n");
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
// Update history
function updateHistory(gid, songs) {
  const path = "guilds/" + gid + "/VC/";
  while (songs.length > 20) {
    songs.pop();
  }
  db.collection(path)
    .doc("history")
    .set({ history: songs });
}
// When user joins VC, remove them from DB online users
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
// Update controller
function pushController(gid, controller) {
  db.collection("guilds/" + gid + "/VC")
    .doc("controller")
    .set(controller, { merge: true });
}

// When user leaves VC, remove them from DB online users
function popUser(gid, id) {
  db.collection("guilds/" + gid + "/VC")
    .doc(id)
    .delete();
}

module.exports = {
  pushUser: pushUser,
  pushController: pushController,
  popUser: popUser,
  getQueue: getQueue,
  authBot: authBot,
  addSong: addSong,
  addSongFromUrl: addSongFromUrl,
  removeSong: removeSong,
  shiftSong: shiftSong,
  shuffleQueue: shuffleQueue
};
