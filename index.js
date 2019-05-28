const fs = require('fs')
const path = require('path')
const adb = require('adbkit')
const Promise = require('bluebird')
const inquirer = require('inquirer')
const low = require('lowdb')
const shortid = require('shortid')
const ora = require('ora')

const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)
const client = adb.createClient()
const dataPath = "/sdcard/Android/data/"
const obbStorepath = "/sdcard/Android/obb/"
const supportedGames = {
    "unity.SUPERHOT_Team.SUPERHOT_VR_QA": {
        title: "SUPERHOT",
        savefile: "files/VRsuper.hot",
        appid: "unity.SUPERHOT_Team.SUPERHOT_VR_QA"
    }
}

let userAnswers = {}

function beforeClose(){
    console.log("Have a nice day")
    process.exit()
}

function userAnswerHelper(answer){
    Object.assign(userAnswers, answer)
}

function sideload(){
    inquirer.prompt([
        {
            type: "input",
            message: "Drag and drop an apk file here and press enter (or type the path here)",
            name: "sideloadAPK"
        },
        {
            type: "input",
            message: "Some apps require an OBB to install drag and drop the file here and press enter (or type its path) otherwise just press enter",
            name: "sideloadOBB"
        }
    ]).then( answer => {
        let {sideloadAPK, sideloadOBB} = answer
        fs.readFile(sideloadAPK, (err1, result1) => {
            fs.readFile(sideloadOBB, (err2, result2) => {
                if(err2){
                    sideloadOBB = null
                }
                if(err1){
                    console.log("I can't seem to find that apk, try again?")
                }else{
                    let apkInstallSpinner = ora("Installing Apk").start()
                    client.install(userAnswers.chosenDevice, sideloadAPK).then(function(){
                        apkInstallSpinner.stop()
                        console.log("APK installed")
                        if(sideloadOBB !== null || sideloadOBB !== ""){
                            console.log("Preparing to load OBB")
                            //const filenameOBB = path.basename(sideloadOBB)
                            if(filenameOBB.startsWith("main.1")){
                                let packageid = filenameOBB.substr("main.1".length + 1)
                                let obbInstallSpinner = ora("Installing OBB").start()
                                client.push(userAnswers.chosenDevice, sideloadOBB, `${obbStorepath}${packageid}/${filenameOBB}`)
                                .then(function(){
                                    obbInstallSpinner.stop()
                                    console.log("OBB successfully installed")
                                })
                                .catch(function(){
                                    obbInstallSpinner.stop()
                                    console.warn("An error occured while writing OBB to device")
                                })
                        
                            }else{
                                console.warn("It seems your OBB file is not properly formated. It's name should look like this `main.1.<packageid>`")
                            }
                        }

                    }).catch(err => {
                        apkInstallSpinner.stop()
                        console.log("There was an error installing the APK, it may already be installed or the file was invalid")
                    })
                }
            }) 
            
        })
    })
}

function scanForDevices() {
    return client.listDevices().then(devices => {
        //console.debug(devices)
        return Promise.map(devices, device => {
            return client.getProperties(device.id).then(props => {
                return {
                    id: device.id,
                    brand: props['ro.product.manufacturer'],
                    model: props['ro.product.model']
                };
            })
        })
    }).catch(err => {
        console.log("Error searching for Devices: ")
    })
}

function actionChooser(){
    inquirer.prompt([
        {
            type: "list",
            name: "action1Choice",
            message: "What would you like to do?",
            choices: [
                { name: "Save Managment", value: 0 },
                { name: "Sideload App", value: 1 },
                { name: "Device Info", value: 2 },
                { name: "Change Device", value: 3},
                { name: "Quit", value: 4}
            ]
        }
    ]).then((actionChoiceAnswer) => {
        userAnswerHelper(actionChoiceAnswer)
        //console.debug(userAnswers)
        switch(userAnswers.action1Choice){
            case 0: 
                saveManagment()
                break
            case 1: 
                sideload()
                break
            case 2:
                console.log("This feature is not yet implemented")
                actionChooser()
                break
            case 3: 
                promptForDevice()
                break
            case 4:
                beforeClose()
                break

        }
    })
}

function promptForDevice() {
    return scanForDevices().then(function (devices) {
        let deviceOptions = devices.filter(device => {
            return device.brand !== "oculus"
        }).map(device => {
            return {
                name: `${device.brand} ${device.model}`,
                value: device.id
            }
        })
        deviceOptions.push({
            name: "Search Again",
            value: "searchAgain"
        })
        deviceOptions.push({
            name: "Quit",
            value: "quit"
        })
        inquirer.prompt([{
            type: 'list',
            name: 'chosenDevice',
            message: 'Please Select Your Device',
            choices: deviceOptions
        }]).then(answer1 => {
            userAnswerHelper(answer1)
            switch (userAnswers.chosenDevice) {
                case "searchAgain":
                    promptForDevice()
                    break
                case "quit":
                    beforeClose()
                    break
                default:
                    return userAnswers.chosenDevice
            }
        }).then(function(){
            actionChooser()
        }).catch(err => {
            console.log("An Error has Occured")
        })
    })
}

function scanForGames(deviceid) {
    if (deviceid === undefined) {
        return
    }
    return client.readdir(deviceid, dataPath)
        .then(function (files) {
            var recognizedGames = [];
            files.forEach(function (file) {
                if (!file.isFile()) {
                    if (file.name in supportedGames) {
                        recognizedGames.push({
                            title: supportedGames[file.name].title,
                            path: `${dataPath}${file.name}/${supportedGames[file.name].savefile}`,
                            appid: file.name
                        })
                    } else {

                        recognizedGames.push({
                            title: file.name,
                            path: `${dataPath}${file.name}`,
                            appid: file.name
                        })
                    }
                }
            })
            return recognizedGames;
        }).catch()

}

function saveManagment(){
    scanForGames(userAnswers.chosenDevice).then(gamesList => {
        let foundGames = gamesList;
        let gameChoices = foundGames.map(function (item) {
            return {
                name: item.title,
                value: item
            }
        })

        inquirer.prompt([{
                type: 'list',
                name: "selectedGame",
                message: "Which game would you like to work on?",
                choices: gameChoices
            },
            {
                type: 'list',
                name: "action",
                message: "What would you like to do?",
                choices: [{
                        name: "Backup",
                        value: 0
                    },
                    {
                        name: "Restore",
                        value: 1
                    },
                    {
                        name: "Reset",
                        value: 2
                    },
                    {
                        name: "Go Back",
                        value: 3
                    }
                ]
            }
        ]).then(answer2 => {
            userAnswerHelper(answer2)
            console.log(userAnswers)
            switch (userAnswers.action) {
                case 0:
                    backupGameFile(userAnswers.chosenDevice, userAnswers.selectedGame)
                    break
                case 1:
                    restoreGameFile(userAnswers.chosenDevice, userAnswers.selectedGame)
                    break
                case 2:
                    resetSaveFile(userAnswers.chosenDevice, userAnswers.selectedGame)
                    break
                case 3:
                    actionChooser()
                    break
            }
        }).catch(err => {
            console.log("Error Scanning For Games")
        })
    })
}

function init() {
    console.log("Welcome to the Oculus Quest Toolkit")
    if (!fs.existsSync("./saves")) {
        fs.mkdirSync("./saves")
    }
    db.defaults({
            saves: [],
            count: 0
        })
        .write()
    promptForDevice()

}

function backupGameFile(deviceid, gameinfo) {
    inquirer.prompt([{
        type: "input",
        name: "saveTitle",
        message: "What would you like to name this save file?"
    }]).then(answers => {
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
                    .push({
                        id,
                        name: answers.saveTitle,
                        path: savePath,
                        app: gameinfo.title,
                        appid: gameinfo.appid
                    })
                    .write()
            })



    })

}

function restoreGameFile(deviceid, gameinfo) {
    //console.log(gameinfo) // title, path
    let saves = db.get('saves').value().filter(item => item.app == gameinfo.title)
    let options = saves.map(item => {
        return {
            name: item.name,
            value: item.id
        }
    })
    inquirer.prompt([{
        type: 'list',
        name: "saveid",
        message: "Which Save would you like to restore?",
        choices: options
    }]).then(answers => {
        let save = db.get('saves').find({
            id: answers.saveid
        }).value()
        //console.log(save)

        return client.push(deviceid, save.path, `${dataPath}${save.appid}/${supportedGames[save.appid].savefile}`)
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

module.exports = {
    scanForDevices,
    resetSaveFile,
    restoreGameFile,
    backupGameFile,
    promptForDevice
}