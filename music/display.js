function displaySearchList(searchList, message) {
  if (searchList.length == 0) {
    return message.channel.send("No search items in list.");
  }
  let i = 0;
  var formattedList = "Results: \n";
  formattedList += "```";
  for (let searchItem of searchList) {
    formattedList += i + ": " + searchItem.title + "\n";
    i++;
  }
  formattedList += "```";
  return message.channel.send(formattedList);
}

function currentSong(message, serverQueue) {
  var song = serverQueue.songs[0];
  if (song) {
    return message.channel.send(`Now playing: ${song.title}`);
  }
}
function nextSong(message, serverQueue) {
  var song = serverQueue.songs[1];
  if (song) {
    return message.channel.send(`Up next: ${song.title}`);
  }
}
function listSongs(message, serverQueue) {
  var i = 0;
  if(!serverQueue || !serverQueue.songs){
    return message.channel.send("There are no songs in the queue")
  }
  var formattedList = "```";
  for (let song of serverQueue.songs) {
    formattedList += `${i} - ${song.title}\n`;
    i++;
    if (i % 10 == 0) {
      formattedList += "```";
      message.channel.send(formattedList);
      formattedList = "```";
    }
  }
  if (i % 10 != 0) {
    formattedList += "```";
    message.channel.send(formattedList);
  }
}

module.exports = {
  displaySearchList: displaySearchList,
  current: currentSong,
  list: listSongs,
  next: nextSong
};
