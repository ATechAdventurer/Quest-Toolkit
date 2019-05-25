const fs = require('fs')
const adb = require('adbkit')
const Promise = require('bluebird')
const inquirer = require('inquirer')
const low = require('lowdb')
const shortid = require('shortid')

const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)
let client = adb.createClient()

const path = "/sdcard/Android/data/"
const supportedGames = {
    "unity.SUPERHOT_Team.SUPERHOT_VR_QA": { title: "SUPERHOT", savefile: "files/VRsuper.hot", appid: "unity.SUPERHOT_Team.SUPERHOT_VR_QA" },
    //"com.beatgames.beatsaber.demo": { title: "BeatSaber Demo", savefile: "files/PlayerData.dat", appid: "com.beatgames.beatsaber.demo" }
}

function scanForDevices() {
    return client.listDevices().then(devices => {
        console.log(devices)
        return Promise.map(devices, device => {
            return client.getProperties(device.id).then(props => {
                return { id: device.id, brand: props['ro.product.manufacturer'], model: props['ro.product.model'] };
            })
        })
    }).catch(err => {
        console.log("I am an error on line 28: ", err)
    })
}


function promptForDevice() {
    return scanForDevices().then(function (devices) {
        let deviceOptions = devices.filter(device => {
            return device.brand !== "oculus"
        }).map(device => {
            return { name: `${device.brand} ${device.model}`, value: device.id }
        })
        deviceOptions.push({ name: "Search Again", value: "searchAgain" })
        deviceOptions.push({ name: "Quit", value: "quit" })
        inquirer.prompt([{
            type: 'list',
            name: 'chosenDevice',
            message: 'Please Select Your Device',
            choices: deviceOptions
        }]).then(answers => {
            switch (answers.chosenDevice) {
                case "searchAgain":
                    promptForDevice()
                    break
                case "quit":
                    process.exit()
                    break
                default:
                    return answers.chosenDevice
            }
        }).then(deviceid => {
            scanForGames(deviceid).then(gamesList => {
                let foundGames = gamesList;
                let gameChoices = foundGames.map(function (item) {
                    return { name: item.title, value: item }
                })
                //console.log(gameChoices)
                inquirer.prompt([
                    {
                        type: 'list',
                        name: "selectedGame",
                        message: "Which game would you like to work on?",
                        choices: gameChoices
                    },
                    {
                        type: 'list',
                        name: "action",
                        message: "What would you like to do?",
                        choices: [
                            { name: "Backup", value: { action: 0, deviceid } },
                            { name: "Restore", value: { action: 1, deviceid } },
                            { name: "Reset", value: { action: 2, deviceid } },
                        ]
                    }
                ]).then(answers => {
                    switch (answers.action.action) {
                        case 0:
                            backupGameFile(answers.action.deviceid, answers.selectedGame)
                            break
                        case 1:
                            restoreGameFile(answers.action.deviceid, answers.selectedGame)
                            break
                        case 2:
                            resetSaveFile(answers.action.deviceid, answers.selectedGame)
                            break
                    }
                }).catch(err => {
                    console.log("I am an error on line 122: ", err)
                })
            })
        }).catch(err => {

        })
    })
}

function scanForGames(deviceid) {
    console.log("Have I happened yet")
    if (deviceid === undefined) {
        return
    }
    return client.readdir(deviceid, path)
        .then(function (files) {
            var recognizedGames = [];
            files.forEach(function (file) {
                if (file.name in supportedGames) {
                    //console.log(`Found: ${supportedGames[file.name]}`)
                    recognizedGames.push({ title: supportedGames[file.name].title, path: `${path}${file.name}/${supportedGames[file.name].savefile}`, appid: file.name })
                }
            })
            return recognizedGames;
        }).catch()

}

function init() {
    if (!fs.existsSync("./saves")) {
        fs.mkdirSync("./saves")
    }
    db.defaults({ saves: [], count: 0 })
        .write()
    promptForDevice()

}

function backupGameFile(deviceid, gameinfo) {
    inquirer.prompt([
        {
            type: "input",
            name: "saveTitle",
            message: "What would you like to name this save file?"
        }
    ]).then(answers => {
        const id = shortid.generate()
        const savePath = `./saves/${gameinfo.title}-${id}-${answers.saveTitle}.questsaver`;

        return client.pull(deviceid, gameinfo.path)
            .then(function (transfer) {
                return new Promise(function (resolve, reject) {
                    var fn = savePath
                    transfer.on('progress', function (stats) {
                        console.log('[%s] Pulled %d bytes so far',
                            deviceid,
                            stats.bytesTransferred)
                    })
                    transfer.on('end', function () {
                        console.log('[%s] Pull complete', deviceid)
                        resolve(deviceid)
                    })
                    transfer.on('error', reject)
                    transfer.pipe(fs.createWriteStream(fn))
                })
            }).then(function () {
                db.get('saves')
                    .push({ id, name: answers.saveTitle, path: savePath, app: gameinfo.title, appid: gameinfo.appid })
                    .write()
            })



    })

}

function restoreGameFile(deviceid, gameinfo) {
    //console.log(gameinfo) // title, path
    let saves = db.get('saves').value().filter(item => item.app == gameinfo.title)
    let options = saves.map(item => {
        return { name: item.name, value: item.id }
    })
    inquirer.prompt([
        {
            type: 'list',
            name: "saveid",
            message: "Which Save would you like to restore?",
            choices: options
        }
    ]).then(answers => {
        let save = db.get('saves').find({ id: answers.saveid }).value()
        //console.log(save)

        return client.push(deviceid, save.path, `${path}${save.appid}/${supportedGames[save.appid].savefile}`)
            .then(function (transfer) {
                return new Promise(function (resolve, reject) {
                    transfer.on('progress', function (stats) {
                        console.log('[%s] Pushed %d bytes so far',
                            deviceid,
                            stats.bytesTransferred)
                    })
                    transfer.on('end', function () {
                        console.log('[%s] Push complete', deviceid)
                        resolve()
                    })
                    transfer.on('error', reject)
                })
            })

    })

}

function resetSaveFile(deviceid, gameinfo) {

        return client.clear(deviceid, gameinfo.appid)
        .then(function () {
            console.log('Done Reseting Gamefile')
        })
        .catch(function (err) {
            console.error('Something went wrong:', err.stack)
        })

}


init()
