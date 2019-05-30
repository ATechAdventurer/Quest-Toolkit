const fs = require('fs')
const path = require('path')
const adb = require('adbkit')
const Promise = require('bluebird')
const inquirer = require('inquirer')
const low = require('lowdb')
const shortid = require('shortid')
const ora = require('ora')
const { exec } = require('child_process')

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
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

// Menus

function actionPrompt() { //AKA Main Menu
    inquirer.prompt([
        {
            type: "list",
            name: "action1Choice",
            message: "What would you like to do?",
            choices: [
                { name: "Save Managment", value: 0 },
                { name: "Sideload App", value: 1 },
                { name: "Device Info", value: 2 },
                { name: "Change Device", value: 3 },
                { name: "Install Custom BeatSaber Songs (Alpha, Windows Only)", value: 4 },
                { name: "Quit", value: 5 }
            ]
        }
    ]).then((actionChoiceAnswer) => {
        userAnswerHelper(actionChoiceAnswer)
        //console.debug(userAnswers)
        switch (userAnswers.action1Choice) {
            case 0:
                saveManagmentPrompt()
                break
            case 1:
                sideloadPrompt()
                break
            case 2:
                propertiesPrompt()
                break
            case 3:
                devicePrompt()
                break
            case 4:
                beatsaberMaps()
                break
            case 5:
                closeApplication()
                break
        }
    })
}

function sideloadPrompt() {
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
    ]).then(answer => {
        sideload(answer)
    })
}

function devicePrompt() {
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
                    devicePrompt()
                    break
                case "quit":
                    closeApplication()
                    break
                default:
                    return userAnswers.chosenDevice
            }
        }).then(function () {
            actionPrompt()
        }).catch(err => {
            console.log("An Error has Occured")
        })
    })
}

function saveManagmentPrompt() {
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
                    actionPrompt()
                    break
            }
        }).catch(err => {
            console.log("Error Scanning For Games")
        })
    })
}

function propertiesPrompt() {
    getProperties().then(properties => {
        inquirer.prompt([{
            type: "list",
            message: "What would you like to do?",
            name: "propertiesAnswer",
            choices: [
                { name: "Write properties to file", value: 0 },
                { name: "Back", value: 1 }
            ]
        }]).then(answer1 => {
            switch (answer1.propertiesAnswer) {
                case 0:
                    fs.writeFile(`${userAnswers.chosenDevice}-properties.json`, JSON.stringify(properties, null, 2), err => {
                        if (!err) {
                            console.log(`Wrote properties to ${userAnswers.chosenDevice}-properties.json`)
                        } else {
                            console.warn("An error occured: ", err)
                        }
                        actionPrompt()
                    })
                    break
                case 1:
                    actionPrompt()
                    break
            }
        })
    })
}



// Helpers

function userAnswerHelper(answer) {
    Object.assign(userAnswers, answer)
}

// Routes

function closeApplication() {
    console.log("Have a nice day")
    process.exit()
}

// Functions

function beatsaberMaps() {
    console.log(`This is kinda buggy so bear with me
    I will walk you through getting custom songs in beatsaber on quest
    First find a song you want to add: (I recommend going to  https://bsaber.com/songs/top )
    Find a song as a zip file extract it and drop the folder into the 'CustomSongFiles' folder`)
    if (fs.existsSync('./BSTools')) {
        inquirer.prompt([
            {
                type: "confirm",
                name: "legalBS",
                message: "Do you have a legal copy of BS on your Quest?"
            },
            {
                type: 'confirm',
                name: 'setJDK',
                message: "Make sure to set your JDK path in ./BSTool/installsongs.cmd"
            }
        ]).then(answers => {
            let { legalBS, } = answers
            
            if (legalBS) {
                console.log("Sweet, lets get started")
                let installingSpinner = ora('Pathching and Installing').start()
                exec(`.\\BSTools\\installsongs.cmd`, function (err1, stdout1, stderr1){
                    installingSpinner.stop()
                    console.log(stdout1)
                })

                /*client.pull(userAnswers.chosenDevice, "/data/app/com.beatgames.beatsaber-1/base.apk").then(function (transfer) {

                    var fn = path.join(__dirname, "\\originalAPKs\\base.apk")
                    transfer.on('progress', function (stats) {
                        console.log('[%s] Pulled %d bytes so far',
                            userAnswers.chosenDevice,
                            stats.bytesTransferred)
                    })
                    transfer.on('end', function () {
                        console.log('[%s] Pull complete', device.id)
                        resolve(device.id)
                    })
                    transfer.on('error', reject)
                    transfer.pipe(fs.createWriteStream(fn))

                })
                */
            } else {
                console.log("It will probably not work and may damage your system, Aborting")
                actionPrompt()
            }
        })
    } else {
        console.log("It looks like some tools are missing, try downloading the program again")
    }
}

function sideload(answer) {
    let { sideloadAPK, sideloadOBB } = answer
    fs.readFile(sideloadAPK, (err1, result1) => {
        fs.readFile(sideloadOBB, (err2, result2) => {
            if (err2) {
                sideloadOBB = null
            }
            if (err1) {
                console.log("I can't seem to find that apk, try again?")
            } else {
                let apkInstallSpinner = ora("Installing Apk").start()
                client.install(userAnswers.chosenDevice, sideloadAPK).then(function () {
                    apkInstallSpinner.stop()
                    console.log("APK installed")
                    if (sideloadOBB !== null || sideloadOBB !== "") {
                        console.log("Preparing to load OBB")
                        const filenameOBB = path.basename(sideloadOBB)
                        if (filenameOBB.startsWith("main.1")) {
                            let packageid = filenameOBB.substr("main.1".length + 1)
                            let obbInstallSpinner = ora("Installing OBB").start()
                            client.push(userAnswers.chosenDevice, sideloadOBB, `${obbStorepath}${packageid}/${filenameOBB}`)
                                .then(function () {
                                    obbInstallSpinner.stop()
                                    console.log("OBB successfully installed")
                                    return 1
                                })
                                .catch(function () {
                                    obbInstallSpinner.stop()
                                    console.warn("An error occured while writing OBB to device")
                                    return 0
                                })

                        } else {
                            console.log("The OBB is not in the proper naming convention, This program will soon be smart enough to figure it out")

                        }
                    }

                }).catch(err => {
                    apkInstallSpinner.stop()
                    console.log("There was an error installing the APK, it may already be installed or the file was invalid")
                })
            }
        })

    })
}


function getProperties(deviceid = userAnswers.chosenDevice) {
    return client.getProperties(userAnswers.chosenDevice).then((properties) => {
        return properties;
    }).catch(err => {
        console.log("An error occured", err)
    })
}


function scanForDevices(deviceid = userAnswers.chosenDevice) {
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


function scanForGames(deviceid = userAnswers.chosenDevice) {
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
                        //Arbitrary App Save Managment coming soon

                        /*recognizedGames.push({
                            title: file.name,
                            path: `${dataPath}${file.name}`,
                            appid: file.name
                        })*/
                    }
                }
            })
            return recognizedGames;
        }).catch()

}


function backupGameFile(gameinfo, deviceid = userAnswers.chosenDevice) {
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

function restoreGameFile(gameinfo, deviceid = userAnswers.chosenDevice) {
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

function resetSaveFile(gameinfo, deviceid = userAnswers.chosenDevice) {

    return client.clear(deviceid, gameinfo.appid)
        .then(function () {
            console.log('Done Reseting Gamefile')
        })
        .catch(function (err) {
            console.error('Something went wrong:', err.stack)
        })

}

function init() {
    console.log("Welcome to the Oculus Quest Toolkit")
    if (!fs.existsSync("./saves")) {
        fs.mkdirSync("./saves")
    }
    if (!fs.existsSync("./CustomSongFiles")) {
        fs.mkdirSync("./CustomSongFiles")
    }
    db.defaults({
        saves: [],
        count: 0
    })
        .write()
    devicePrompt()

}

init()

module.exports = {
    scanForDevices,
    resetSaveFile,
    restoreGameFile,
    backupGameFile,
    promptForDevice: devicePrompt
}