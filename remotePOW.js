"use strict"

const IOTA = require('iota.lib.js')
const ccurl = require('ccurl.interface.js')
const http = require('http')
const express = require('express')
const body = require('body-parser')
const program = require('commander')

program
  .version('1.0.0')
  .option('-m, --max-mwm [mwm]', 'Max Minimum Weight Magnitude', 15)
  .option('-p, --port [port]', 'Port to host the server on', 80)
  .option('-c, --ccurl [ccurlLocation]', 'Directory of libccurl.so', '.')
  .parse(process.argv)

const iota = new IOTA()

const server = express();
    server.disable('x-powered-by');
    server.set('etag', false);
    server.use(bodyParser.json());
    server.use(function(req, res){
        var starttime=Date.now();
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Methods", "POST")
        if(req.body.command=="getNodeInfo"){
            res.send({
              appName: "iota.whitey.pow.node.js",
              appVersion: "0.0.1",
              duration: (Date.now()-starttime)
            })
        } else if(req.body.command=="attachToTangle"){
            let fields = req.body;
            if (typeof(fields.minWeightMagnitude)==="undefined"){
                res.status(400);
                res.send({error: "Invalid parameters","duration":(Date.now()-starttime)});
            } else {
                fields.minWeightMagnitude=parseInt(fields.minWeightMagnitude);
                if(fields.minWeightMagnitude > config.maxMwM || fields.minWeightMagnitude < 1){
                    res.status(400);
                    res.send({error: "MwM of " + fields.minWeightMagnitude + " is invalid or over max of " + config.maxMwM,"duration":(Date.now()-starttime)});
                } else if(!fields.trunkTransaction(/^[A-Z9]{81}$/)){
                    res.status(400);
                    res.send({error: "Invalid trunk transaction","duration":(Date.now()-starttime)});
                } else if(!fields.branchTransaction(/^[A-Z9]{81}$/)){
                    res.status(400);
                    res.send({error: "Invalid branch transaction","duration":(Date.now()-starttime)});
                } else if(!checkTrytes(fields.trytes)){
                    res.status(400);
                    res.send({error: "Invalid trytes provided","duration":(Date.now()-starttime)});
                } else {
                    var target=0;
                    var jobcount=10000;
                    for (var i = 0; i < workers.length; ++i) {
                        if(workers[i].jobs<jobcount){
                            target=i;
                            jobcount=workers[i].jobs;
                            if(workers[i].jobs==0){
                              i=workers.length;  
                            }
                        };
                    }
                    if(jobcount>10){
                        console.log("Jobcount critical!");
                    }
                    let curjob=jobs.length;
                    jobs[curjob]={req:req,res:res};
                    workers[target].jobs++;
                    workers[target].handle.send({fields:fields,job:curjob,worker:target,starttime:starttime});                     
                }
            }
        } else if(req.body.command=="getNeighbors"){
            res.send({neighbors: [],"duration":(Date.now()-starttime)})
        } else if(req.body.command=="powInfo"){
            res.send({total: counters.totalrequests,failed: counters.failedrequests, averagetime: counters.averagetime + 'ms',"duration":(Date.now()-starttime)})
        } else {
            res.status(400);
            res.send({error: "Unknown command!","duration":(Date.now()-starttime)});
        }
    });
    http.createServer(server)
    .on('connection', function(socket) {
        socket.setTimeout(60000);
    })
    .listen(config.port, config.ip, () => {
        console.log(getPrintableTime()+" - Bound to "+config.ip+" and listening on and port "+config.port);
    });
}

function nodeAPI(req, res){
	let startTime = Date.now()
	let fields = req.body
	if(fields.minWeightMagnitude > program.maxMwm){
		res.send({error: "Mwm of " + fields.minWeightMagnitude + " is over max of " + program.maxMwm})
	} else {
		//ccurl doesn't update attachment timestamp. Let's do it ourselves.
		let trytes = updateTimestamp(fields.trytes)
		ccurl(fields.trunkTransaction, fields.branchTransaction, fields.minWeightMagnitude, fields.trytes, program.ccurl, (error, success) => {
			if(error) console.log(error)
			res.send({trytes : success}) //emulate node output
			totalrequests += success.length 
			averagetime = Math.floor(((totalrequests - success.length) * averagetime + (Date.now() - startTime)) / totalrequests)
		})
	}
	
}

function updateTimestamp(trytes){
	//trytes should be an array, let's go through it and build a new one
	let updatedTrytes = []
	for(var i = 0; i < trytes.length; i++){
		let txn = iota.utils.transactionObject(trytes[i]) //open the object from the raw trytes
		txn.attachmentTimestamp = Date.now() //set the timestamp
		updatedTrytes.push(iota.utils.transactionTrytes(txn)) // put it back in trytes format and attach it to the new array
	}
	return updatedTrytes
}




function infoPage(req, res){
	res.send({total: totalrequests, averagetime: averagetime + 'ms'})
}

