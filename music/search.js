const db = require("./database");
const display = require("./display");
const admin = require("./admin");
const ytdl = require("ytdl-core");
var { google } = require("googleapis");

async function searchSong(message) {
  const args = message.content.split(" ");
  var maxResults = 5;
  try {
    if (!args[1]) {
      return message.channel.send("```!search name```");
    }
    var service = google.youtube("v3");
    var search = args[1].toLowerCase();
    for (var i = 2; i < args.length; i++) {
      search += "+";
      search += args[i];
    }
    var docs = await db.getSearchList(false, search);
    if (docs) {
      var songs = [];
      for (let doc of docs) {
        const url = "https://www.youtube.com/watch?v=" + doc.data().id.videoId;
        const songInfo = await ytdl.getInfo(url);
        songs.push({
          title: songInfo.title,
          url: songInfo.video_url,
          id: doc.data().id.videoId
        });
      }
      admin.searchList.set(message.guild.id, songs);
      display.displaySearchList(
        admin.searchList.get(message.guild.id),
        message
      );
    } else {
      // Search Youtube for video
      service.search.list(
        {
          auth: admin.youtubeKey[0],
          part: "snippet",
          type: "video",
          maxResults: maxResults,
          q: search
        },
        async function(err, response) {
          if (err) {
            console.log(err);
            if (err.code == 403 || err.code == 429) {
              admin.youtubeKey[0] = auth.backupKey;
              message.channel.send(
                "Quota reached, switching to backup key...\n Try again!"
              );
            }
            return;
          }
          var results = response.data.items;
          db.pushSearch(false, search, results);
          var songs = [];
          for (let i = 0; i < results.length; i++) {
            const url =
              "https://www.youtube.com/watch?v=" + results[i].id.videoId;
            const songInfo = await ytdl.getInfo(url);
            songs.push({
              title: songInfo.title,
              url: songInfo.video_url,
              id: results[i].id.videoId
            });
          }
          admin.searchList.set(message.guild.id, songs);
          display.displaySearchList(
            admin.searchList.get(message.guild.id),
            message
          );
        }
      );
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  searchSong: searchSong
};
