"use strict";
const AnyProxy = require("./anyproxy");
const exec = require('child_process').exec;
const fs = require("fs");
const crypto = require('crypto');

const profile = "C:/Users/heqyou_free/Documents/Tencent Files/774471396/FileRecv/xfgo_anyproxy/profile/";
const trunfile = "C:/Users/heqyou_free/Documents/Tencent Files/774471396/FileRecv/xfgo_anyproxy/trunfile/";
const signalServerAddressHost = "http://com.locbytes.xfgo.signal/";
const defaultSetting = "{\"userid\":100100100100,\"password\":\"password\",\"battleCancel\":true,\"uHpSwitch\":true,\"uAtkSwitch\":true,\"uHp\":10,\"uAtk\":10,\"limitCountSwitch\":true,\"skillLv\":true,\"tdLv\":true,\"enemyActNumSwitch\":true,\"enemyActNumTo\":0,\"enemyChargeTurnSwitch\":true,\"enemyChargeTurnto\":6,\"replaceSvtSwitch\":true,\"replaceSvtSpinner\":6,\"replaceSvt2\":true,\"replaceSvt3\":true,\"replaceSvt4\":true,\"replaceSvt5\":true,\"replaceSvt6\":true,\"replaceCraftSwitch\":true,\"replaceCraftSpinner\":1}";
const debugMode = 2;
//1- textfile, 2- consle log
const debugFile = "C:/Users/heqyou_free/Documents/Tencent Files/774471396/FileRecv/xfgo_anyproxy/debug/";

if (!AnyProxy.utils.certMgr.ifRootCAFileExists()) {
	AnyProxy.utils.certMgr.generateRootCA((error, keyPath) => {
		if (!error) {
			const certDir = require('path').dirname(keyPath);
			console.log('根证书生成成功，请从xfgo模块中安装证书，证书本地路径: ', certDir);
			const isWin = /^win/.test(process.platform);
			if (isWin) {
				exec('start .', { cwd: certDir });
			}
		} else {
			console.error('根证书生成失败', error);
		}
	});
}
const options = {
	port: 8001,
	webInterface: 8002,
	rule: {
		summary: "ModifyFGO",
		*beforeSendRequest(requestDetail) {
			if(requestDetail.url.indexOf(signalServerAddressHost)>=0){
				if(requestDetail.requestOptions.method == "GET"){
					if(requestDetail.requestOptions.path.indexOf("getRootCA")>0){
						console.log("获取根证书");
						const rootCA = fs.readFileSync(AnyProxy.utils.certMgr.getRootDirPath()+"/rootCA.crt").toString();
						return {
							response: {
								statusCode: 200,
								header: { 'Content-Type': 'text/html' },
								body: rootCA
							}
						};
					}else{
						var userId=requestDetail.requestOptions.path.substring(2);
						var randomNum=3+parseInt(Math.random()*15, 10);
						var fileName=userId+".txt";
						fs.writeFileSync("trun"+fileName,randomNum);
						return {
							response: {
								statusCode: 200,
								header: { 'Content-Type': 'text/html' },
								body: randomNum.toString()
							}
						};
					}
				}
				if(requestDetail.requestOptions.method == "POST"){
					console.log("更新配置");
					var option = JSON.parse(requestDetail.requestData.toString());
					var uid = option.uid;
					fs.exists("dirName", function(exists) {
						if(exists){
							var oldOption = JSON.parse(profile+uid+"options.json");
							if(option.pw == oldOption.pw){
								fs.writeFileSync(profile+uid+"options.json", optionString);
								return {
									response: {
										statusCode: 200,
										header: { 'Content-Type': 'text/html' },
										body: "success"
									}
								};
							}else{
								return {
									response: {
										statusCode: 200,
										header: { 'Content-Type': 'text/html' },
										body: "failed"
									}
								};
							}
						}else{
							fs.writeFileSync(profile+uid+"options.json", optionString);
							return {
								response: {
									statusCode: 200,
									header: { 'Content-Type': 'text/html' },
									body: "success"
								}
							};
						}
					});
				}
			}else{
				var requestData = requestDetail.requestData.toString();
				var verify1 = (requestDetail.requestData.indexOf("key=battleresult")>0);
				var verify2 = (requestDetail.url.indexOf("ac.php")>0);
				if (verify1 && verify2) {
					var uidreg = /(?<=userId=)\d\d\d\d\d\d\d\d\d\d\d\d/gi;
					var uid = requestDetail.url.match(uidreg);
					var newRequestData = requestData;
					var options = readSetting(uid);
					var verify3 = (options.battleCancel == "true");
					if(verify3){
						var data = requestData.split("&");
						data[11]= customUrlDecode(data[11]);
						var temp = data[11].substring(7);
						var json=JSON.parse(temp);
						if(json.battleResult == 3){
							var userId = data[12].substring(7);
							var fileName = userId+".txt";
							var randomNum = parseInt(fs.readFileSync(trunfile+fileName), 10);
							newRequestData = "";
							json.battleResult = 1;
							json.elapsedTurn = randomNum;
							json.aliveUniqueIds = [];
							temp=JSON.stringify(json);
							data[11]= "result="+customUrlEncode(temp);
							var i=1;
							data.forEach( value => {
								newRequestData += value;
								if(i<data.length){
									newRequestData+="&";
									++i;
								}
							});
						}
						return {
							requestData: newRequestData
						};
					}
				}
			}
		},
		*beforeSendResponse(requestDetail, responseDetail) {
			var response = Object.assign({}, responseDetail.response);
			var verify1 = (requestDetail.requestData.indexOf("key=battlesetup")>0);
			var verify2 = (requestDetail.requestData.indexOf("key=battleresume")>0);
			var verify3 = (requestDetail.url.indexOf("ac.php")>0);
			if( (verify1||verify2) && verify3 ){
				var uidreg = /(?<=userId=)\d\d\d\d\d\d\d\d\d\d\d\d/gi;
				var uid = requestDetail.url.match(uidreg);
				var rawBody = response.body.toString();
				rawBody = rawBody.replace(/%3D/g, "=");
				var jsonStr = new Buffer(rawBody, "base64").toString();
				var decJson = JSON.parse(jsonStr);
				decJson.sign="";
				cLog(rawBody,"origin");
				cLog(jsonStr,"decode");
				var options = readSetting(uid);
				cLog(uid,"userid");
				cLog(JSON.stringify(options),"setting");
				var uHpSwitch = options.uHpSwitch;
				var uAtkSwitch = options.uAtkSwitch;
				var uHp = options.uHp;
				var uAtk = options.uAtk;
				var limitCountSwitch = options.limitCountSwitch;
				var skillLv = options.skillLv;
				var tdLv = options.tdLv;
				var enemyActNumSwitch = options.enemyActNumSwitch;
				var enemyActNumTo = options.enemyActNumTo;
				var enemyChargeTurnSwitch = options.enemyChargeTurnSwitch;
				var enemyChargeTurnto = options.enemyChargeTurnto;
				var replaceSvtSwitch = options.replaceSvtSwitch;
				var replaceSvtSpinner = options.replaceSvtSpinner;
				var replaceSvt1 = options.replaceSvt1;
				var replaceSvt2 = options.replaceSvt2;
				var replaceSvt3 = options.replaceSvt3;
				var replaceSvt4 = options.replaceSvt4;
				var replaceSvt5 = options.replaceSvt5;
				var replaceSvt6 = options.replaceSvt6;
				var replaceCraftSwitch = true//options.replaceCraftSwitch;
				var replaceCraftSpinner = options.replaceCraftSpinner;
				if (decJson['cache']['replaced']['battle'] != undefined) {
					var svts = decJson['cache']['replaced']['battle'][0]['battleInfo']['userSvt'];
					for (var sv in svts) {
						if (sv['hpGaugeType'] != undefined) {
							//work
							if(enemyActNumSwitch){
								sv['maxActNum'] = enemyActNumTo;
							}
							//work
							if(enemyChargeTurnSwitch){
								sv['chargeTurn'] = enemyChargeTurnto;
							}
							//continue;
						}
						if (sv['status'] != undefined && sv['userId'] != undefined && sv['userId'] != '0' && sv['userId'] != 0) {
							//work
							if (uHpSwitch && typeof sv['hp'] === 'number') {
								sv['hp'] = parseInt(sv['hp'])*uHp;
							}else{
								sv['hp'] = String(parseInt(sv['hp'])*uHp);
							}
							if (uAtkSwitch && typeof sv['atk'] === 'number') {
								sv['atk'] = parseInt(sv['atk'])*uAtk;
							}else{
								sv['atk'] = String(parseInt(sv['atk'])*uAtk);
							}
							//work
							if (skillLv) {
								sv['skillLv1'] = 10;
								sv['skillLv2'] = 10;
								sv['skillLv3'] = 10;
							}
							//work
							if (tdLv) {
								console.log("replace td");
								if(typeof sv["treasureDeviceLv"] == typeof ""){
									sv["treasureDeviceLv"] = "5";
							}
							//work
							if (limitCountSwitch) {
								sv['limitCount'] = 4;
								sv['dispLimitCount'] = 4;
								sv['commandCardLimitCount'] = 3;
								sv['iconLimitCount'] = 4;
							}
							//work
							if (replaceSvtSwitch) {
								console.log("replace svt");
								if ((replaceSvt1 && sv['svtId'] == "600200") || replaceSvtSpinner == 1) {
									ReplaceSvt(sv, 602500, 602501, 41650, 13553, 324650, 14246, 12767, false);
								}
								if ((replaceSvt2 && sv['svtId'] == "600100") || replaceSvtSpinner == 2) {
									ReplaceSvt(sv, 500800, 500801, 321550, 322550, 323650, 15259, 11546, false);
								}
								if ((replaceSvt3 && sv['svtId'] == "601400") || replaceSvtSpinner == 3) {
									ReplaceSvt(sv, 501900, 501901, 82550, 100551, 101551, 14409, 11598, false);
								}
								if ((replaceSvt4 && sv['svtId'] == "700900") || replaceSvtSpinner == 4) {
									ReplaceSvt(sv, 500300, 500302, 23650, 25550, 108655, 15359, 11546, false);
								}
								if ((replaceSvt5 && sv['svtId'] == "700500") || replaceSvtSpinner == 5) {
									ReplaceSvt(sv, 702300, 702301, 89550, 2245550, 225550, 14500, 12556, false);
								}
								if ((replaceSvt6 && sv['svtId'] == "701500") || replaceSvtSpinner == 6) {
									//ReplaceSvt(sv, 9939320, 507, 960840, 960845, 89550, 3215000, 3215000, true);
		            	//ReplaceSvt(sv, 9939360, 100, 35551, 960845, 89550, 3215000, 3215000, true);
		            	//ReplaceSvt(sv, 9939370, 9939371, 960842, 960843, 36450, 3215000, 3215000, true);
									ReplaceSvt(sv, 9935510, 9935511, 89550, 321550, 108655, 3215000, 3215000, true);
									sv["treasureDeviceLv"] = 1;
								}
								//continue;
							}
							//not work
							console.log(replaceCraftSwitch)
							console.log(sv["parentSvtId"] != undefined)
							console.log(sv["parentSvtId"])
							console.log(replaceCraftSwitch && typeof sv["parentSvtId"] != "undefined")
							if (replaceCraftSwitch && sv["parentSvtId"] != undefined) {
								console.log("replace carft");
								if (replaceCraftSpinner == 1) {
									sv["skillId1"] = 990068;
								}
								if (replaceCraftSpinner == 2) {
									sv["skillId1"] = 990645;
								}
								if (replaceCraftSpinner == 3) {
									sv["skillId1"] = 990066;
								}
								if (replaceCraftSpinner == 4) {
									sv["skillId1"] = 990062;
								}
								if (replaceCraftSpinner == 5) {
									sv["skillId1"] = 990131;
								}
								if (replaceCraftSpinner == 6) {
									sv["skillId1"] = 990095;
								}
								if (replaceCraftSpinner == 7) {
									sv["skillId1"] = 990113;
								}
								if (replaceCraftSpinner == 8) {
									sv["skillId1"] = 990064;
								}
								if (replaceCraftSpinner == 9) {
									sv["skillId1"] = 990333;
								}
								if (replaceCraftSpinner == 10) {
									sv["skillId1"] = 990629;
								}
								if (replaceCraftSpinner == 11) {
									sv["skillId1"] = 990327;
								}
								if (replaceCraftSpinner == 12) {
									sv["skillId1"] = 990306;
								}
							}
						}
					}
				}
				var newJsonStr = JSON.stringify(decJson);
				var cnReg = /[\u0391-\uFFE5]/gm;
				if (cnReg.test(newJsonStr)) {
					newJsonStr = newJsonStr.replace(cnReg,
					function(str) {
						return "\\u" + str.charCodeAt(0).toString(16);
					});
				}
				newJsonStr=newJsonStr.replace(/\//g, "\\\/");
				//cLog(newJsonStr,"modify");
				var newBodyStr = new Buffer(newJsonStr).toString("base64");
				newBodyStr = newBodyStr.replace(/=/g, "%3D");
				var newBody = new Buffer(newBodyStr);
				response.body = newBody;
				}
				return {
					response: response
				};
			}
		},
		*beforeDealHttpsRequest(requestDetail) {
			if(requestDetail.host.indexOf("s2-bili-fate.bilibiligame.net")>=0){
				return true;
			}else{
				return false;
			}
		}
	},
	silent: !(debugMode==1||debugMode==2)
};
const proxyServer = new AnyProxy.ProxyServer(options);
proxyServer.start();
console.log("科技服务端已启动");
console.log("本机IP：" + getLocalIP());
console.log("端口号：" + options.port);
console.log("输入rs手动重启");
console.log("关闭请使用Ctrl-C");
function customUrlEncode(data) {
	data=data.replace(/"/g,'%22');
	data=data.replace(/'/g,'%27');
	data=data.replace(/:/g,'%3a');
	data=data.replace(/,/g,'%2c');
	data=data.replace(/\[/g,'%5b');
	data=data.replace(/]/g,'%5d');
	data=data.replace(/{/g,'%7b');
	data=data.replace(/}/g,'%7d');
	return data;
}
function customUrlDecode(data) {
	data=data.replace(/%22/g,'"');
	data=data.replace(/%27/g,"'");
	data=data.replace(/%3a/g,':');
	data=data.replace(/%2c/g,',');
	data=data.replace(/%5b/g,'[');
	data=data.replace(/%5d/g,']');
	data=data.replace(/%7b/g,'{');
	data=data.replace(/%7d/g,'}');
	return data;
}
function getLocalIP(){
	var interfaces = require('os').networkInterfaces();
	for(var devName in interfaces){
		var iface = interfaces[devName];
		for(var i=0;i<iface.length;i++){
			var alias = iface[i];
			if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
				return alias.address;
			}
		}
	}
}
function ReplaceSvt(sv, svtId, treasureDeviceId, skillId1, skillId2, skillId3, hp, atk, NolimitCount) {
	sv["svtId"] = svtId;
	sv["treasureDeviceId"] = treasureDeviceId;
	sv["skillId1"] = skillId1;
	sv["skillId2"] = skillId2;
	sv["skillId3"] = skillId3;
	sv["hp"] = hp;
	sv["atk"] = atk;
	if (NolimitCount) {
		sv["limitCount"] = 0;
		sv["dispLimitCount"] = 0;
		sv["commandCardLimitCount"] = 0;
		sv["iconLimitCount"] = 0;
	}
}
function string2bool(str){return str == "true";}
function cLog(str,str2){
	var timestamp = Date.parse(new Date());
	if(debugMode==1){
		fs.writeFileSync(debugFile+timestamp+str2+".txt", str);
	}
	if(debugMode==2){
		console.log("----------Debug Info Start----------");
		console.log("Info: "+str);
		console.log("Time: "+timestamp)
		console.log("Title: "+str2);
		console.log("----------Debug Info End----------");
	}
}
function readSetting(uid){
	var options = JSON.parse(defaultSetting);
	if(uid != null){
		try{
			options = JSON.parse(fs.readFileSync(profile+uid+"options.json"));
		}catch{
			cLog("Read "+profile+uid+"options.json"+" failed","ERROR while reading file")
		}
	}
	return options;
}