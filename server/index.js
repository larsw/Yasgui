var express = require('express'),
	http = require('http'),
	serveStatic = require('serve-static'),
	bodyParser = require('body-parser'),
	extend = require('deep-extend'),
	config = require('./serverconfig.json');

var app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: false })

var argv = require('minimist')(process.argv.slice(2));

if (argv.config) {
	//extend current config with the additional one
	extend(config, require(argv.config));
}
if (argv.port) config.port = argv.port;



//js and css dependencies
app.use('/dist/', serveStatic(__dirname + '/../dist/', {index:false}));
//not really needed, but nice to have anyway
app.use('/doc/', serveStatic(__dirname + '/../doc/'))

//the URLs for the API
app.use('/proxy/', urlencodedParser, require('./corsProxy.js'));

//Use this catch-all: always render YASGUI
app.use('/server.html.manifest', function(req,res) {
	res.sendFile('server.html.manifest', {root: __dirname + '/../'});
});

//Use this catch-all: always render YASGUI
app.use('/', function(req,res) {
	res.sendFile('server.html', {root: __dirname + '/../'});
});

http.createServer(app).listen(config.port)

console.log('Running YASGUI on http://localhost:' + config.port);