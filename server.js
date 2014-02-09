var ssdp = require("peer-ssdp"),
  uuid = require('node-uuid'),
  fs = require('fs'),
  express = require('express'),
  http = require('http'),
  querystring = require('querystring'),
  sys = require('sys'),
  util = require('util'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn;
var addr = getIPAddress();
var port = 8008;
var app = express();
var myUuid = uuid.v4();
//create ssdp 
peer = ssdp.createPeer()
console.log("environment "+addr+":"+port);
peer.on("search",function(headers, address){
  //console.log("-- headers: "+util.inspect(headers));
  if(headers.ST.indexOf("dial-multiscreen-org:service:dial:1") != -1) {
    var replyMessage = {
      LOCATION: "http://"+addr+":"+port+"/ssdp/device-desc.xml",
      ST: "urn:dial-multiscreen-org:service:dial:1",
      "CONFIGID.UPNP.ORG": 7337,
      "BOOTID.UPNP.ORG": 7337,
      USN: "uuid:"+myUuid
    }
    peer.reply(replyMessage, address);
    //console.log("-- reply:"+util.inspect(replyMessage));
  }
});
peer.start();

//web server
app.set('port', 8008);
app.use(function(req, res, next) {
  var data = '';
  req.setEncoding('utf8');
  req.on('data', function(chunk) {
    data += chunk;
  });
  req.on('end', function() {
    req.rawBody = data;
    next();
  });
});
app.disable('x-powered-by');
app.use(express.static(__dirname + '/public'));
app.use(express.logger());
app.use(app.router);
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(function (req, res, next) {
  res.removeHeader("Connection");
  next();
});
app.disable('x-powered-by');

var server = http.createServer(app);

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
app.disable('x-powered-by');

//device description
app.get("/ssdp/device-desc.xml", function(req, res) {
  console.log("-- request app description ");
  fs.readFile('./device-desc.xml', 'utf8', function (err,data) {
    data = data.replace("#uuid#", myUuid).replace("#base#","http://"+req.headers.host).replace("#name#", "Raspcast");
    res.type('xml');
    res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Location");
    res.setHeader("Application-Url", "http://"+req.headers.host+"/apps");
    res.send(data);
  });
});

//rest api
global.youtube = {};
global.youtube.appName = "Youtube";
global.youtube.connectionSvcURL = "";
global.youtube.protocol = "";
global.youtube.state = "stopped";
global.youtube.link = "";

app.get("/apps/YouTube", function(req, res) {
  console.log("-- connecting to yotube app ");
  if(global.youtube.state == "running"){
    global.youtube.protocol = "<protocol>ramp</protocol>";
  }
  fs.readFile('./app.xml', 'utf8', function (err,data) {
    data = data.replace("#name#", global.youtube.appName)
    .replace("#connectionSvcURL#", global.youtube.connectionSvcURL)
    .replace('#protocols#', global.youtube.protocol)
    .replace('#state#', global.youtube.state)
    .replace('#link#', global.youtube.link);
    res.type('xml');
    res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Location");
    res.setHeader("Cache-control", "no-cache, must-revalidate, no-store");
    res.send(data);
  });
});

app.delete("/apps/YouTube/web-1", function(req, res) {
  console.log("--- close youtube app "+ util.inspect(req.params));
  fs.readFile('./app.xml', 'utf8', function (err,data) {
    //close kiosk mode
    global.youtube.connectionSvcURL = "";
    global.youtube.state = "stopped";
    global.youtube.link = "";
    data = data.replace("#name#", global.youtube.appName)
    .replace("#connectionSvcURL#", global.youtube.connectionSvcURL)
    .replace('#protocols#', global.youtube.protocol)
    .replace('#state#', global.youtube.state)
    .replace('#link#', global.youtube.link);
    /*
    if(global.youtube.process){
      global.youtube.process.kill('SIGINT');
      //exec("kill -9 "+global.youtube.process.setgid());
      global.youtube.process = null;
    } 
    */
    var command = "/usr/bin/chromium";
    spawn(command, ["http://localhost:8008"]);   
    res.type('xml');
    res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Location");
    res.setHeader("Cache-control", "no-cache, must-revalidate, no-store");
    res.send(data);
  });
});

app.post("/apps/YouTube", function(req, res) {
  console.log("--- open youtube app ");
  global.youtube.state = "running";
  global.youtube.link = "<link rel='run' href='web-1'/>";
  //global.youtube.connectionSvcURL = "http://"+addr+":8008/connection/"+global.youtube.appName;
  //show kiosk
  var url = "https://www.youtube.com/tv?"+req.rawBody
  var command = "/usr/bin/chromium";
  spawn(command, [url]);
  res.setHeader("Location", "http://"+addr+":8008/apps/"+global.youtube.appName+"/web-1");
  res.send(201,"");
});

console.log("Starting chromium");
//start chromium
var args = [
'--allow-running-insecure-content',
'--no-default-browser-check',
'--ignore-gpu-blacklist',
'--no-first-run',
'--kiosk',
'--disable-translate',
"http://localhost:8008"
]
spawn("/usr/bin/chromium", args);

function getIPAddress() {
  var n = require('os').networkInterfaces();
  var ip = []
  for (var k in n) {
    var inter = n[k];
    for (var j in inter) {
      if (inter[j].family === 'IPv4' && !inter[j].internal) {
        return inter[j].address
      }
    }
  }
}