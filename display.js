const admin = require("./music/admin.js");

function printCommands(message) {
  var formattedMessage = "All songs are from Youtube\n";
  formattedMessage += "```";
  formattedMessage += "!add url              - add song using URL\n";
  formattedMessage += "!add name             - add first song from name search results\n";
  // formattedMessage += "!add playlist url     - add playlist using URL\n";
  // formattedMessage +=
  //   "!add playlist name    - add first playlist from name search results\n";
  // formattedMessage +=
  //   "!search name          - list first five search results\n";
  // formattedMessage +=
  //   "!select id            - select from previous search results\n";
  formattedMessage += "!remove index         - remove song from queue\n";
  formattedMessage += "!shift index          - shift song to next\n";
  // formattedMessage += "!play                 - resume playback\n";
  // formattedMessage += "!pause                - pause playback\n";
  formattedMessage += "!skip                 - skip to next song\n";
  formattedMessage += "!shuffle              - shuffle songs currently in queue\n";
  // formattedMessage += "!shuffle mode         - toggle shuffling new songs\n";
  // formattedMessage += "!current              - list current song\n";
  // formattedMessage += "!next                 - list next song\n";
  formattedMessage += "!queue                - list all songs in queue\n";
  // formattedMessage += "!volume 0:30          - change volume\n";
  // formattedMessage += "!loop                 - toggle loop mode\n";
  // formattedMessage += "\nExamples: \n";
  // formattedMessage += "!add brazil declan mckenna\n";
  // formattedMessage += "!add playlist life is strange soundtrack\n";
  // formattedMessage += "!search come in weatherday\n";
  // formattedMessage += "!volume 15\n";
  formattedMessage += "```";
  return message.channel.send(formattedMessage, {
    embed: { title: "UwU", url: "https://monika-music-bot.web.app" }
  });
}

function printQueue(gid, message){
  const queue = admin.queue.get(gid);
  var formattedMessage = "```";
  let i = 1;
  for(let i = 0; i < queue.length; i++){
    if(queue[i].artist && queue[i].artist != ""){
      formattedMessage += (i+1) + ": " + queue[i].title + " - " + queue[i].artist + "\n";
    }else{
      formattedMessage += (i+1) + ": " + queue[i].title + "\n";
    }
  }
  formattedMessage += "```";
  return message.channel.send(formattedMessage);
}

module.exports = {
  printCommands: printCommands,
  printQueue: printQueue
};
