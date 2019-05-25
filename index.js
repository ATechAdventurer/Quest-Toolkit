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
    "com.beatgames.beatsaber.demo": { title: "BeatSaber Demo", savefile: "files/PlayerData.dat", appid: "com.beatgames.beatsaber.demo" }
}

function scanForGames() {
    return client.listDevices()
        .then(function (devices) {
            return Promise.map(devices, function (device) {
                return client.readdir(device.id, path)
                    .then(function (files) {
                        var recognizedGames = [];
                        files.forEach(function (file) {
                            if (file.name in supportedGames) {
                                //console.log(`Found: ${supportedGames[file.name]}`)
                                recognizedGames.push({ title: supportedGames[file.name].title, path: `${path}${file.name}/${supportedGames[file.name].savefile}` })
                            }
                        })
                        return recognizedGames;
                    })
            })
        })
        .catch(function (err) {
            console.log(err)
        })

}

function init() {
    if (!fs.existsSync("./saves")) {
        fs.mkdirSync("./saves")
    }
    db.defaults({ saves: [], count: 0 })
        .write()
    scanForGames().then(function (value) {
        let foundGames = value[0];
        console.log(foundGames)
        let gameChoices = foundGames.map(function (item) {
            return { name: item.title, value: item }
        })
        console.log(gameChoices)
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
                    { name: "Backup", value: 0 },
                    { name: "Restore", value: 1 },
                    { name: "Reset", value: 2 },
                ]
            }
        ]).then(answers => {
            switch (answers.action) {
                case 0:
                    backupGameFile(answers.selectedGame)
                    break
                case 1:
                    restoreGameFile(answers.selectedGame)
                    break
            }
        }).catch(err => {
            console.log(err)
        })
    })
}

function backupGameFile(gameinfo) {
    inquirer.prompt([
        {
            type: "input",
            name: "saveTitle",
            message: "What would you like to name this save file?"
        }
    ]).then(answers => {
        const id = shortid.generate()
        const savePath = `${__dirname}/saves/${gameinfo.title}-${id}-${answers.saveTitle}.questsaver`;
        client.listDevices()
            .then(function (devices) {
                return Promise.map(devices, function (device) {
                    return client.pull(device.id, gameinfo.path)
                        .then(function (transfer) {
                            return new Promise(function (resolve, reject) {
                                var fn = savePath
                                transfer.on('progress', function (stats) {
                                    console.log('[%s] Pulled %d bytes so far',
                                        device.id,
                                        stats.bytesTransferred)
                                })
                                transfer.on('end', function () {
                                    console.log('[%s] Pull complete', device.id)
                                    resolve(device.id)
                                })
                                transfer.on('error', reject)
                                transfer.pipe(fs.createWriteStream(fn))
                            })
                        })
                })
            })
            .then(function () {
                console.log('Done pulling file from all connected devices')
            })
            .catch(function (err) {
                console.error('Something went wrong:', err.stack)
            })
        db.get('saves')
            .push({ id, name: answers.saveTitle, path: savePath, app: gameinfo.title, appid: gameinfo.appid })
            .write()
    })

}

function restoreGameFile(gameinfo) {
    console.log(gameinfo) // title, path
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
        console.log(save)
        client.listDevices()
            .then(function (devices) {
                return Promise.map(devices, function (device) {
                    return client.push(device.id, save.path, `${path}${save.appid}/${supportedGames[save.appid].savefile}`)
                        .then(function (transfer) {
                            return new Promise(function (resolve, reject) {
                                transfer.on('progress', function (stats) {
                                    console.log('[%s] Pushed %d bytes so far',
                                        device.id,
                                        stats.bytesTransferred)
                                })
                                transfer.on('end', function () {
                                    console.log('[%s] Push complete', device.id)
                                    resolve()
                                })
                                transfer.on('error', reject)
                            })
                        })
                })
            })
            .then(function () {
                console.log('Done pushing save file to all connected devices')
            })
            .catch(function (err) {
                console.error('Something went wrong:', err.stack)
            })
    })

}



init()