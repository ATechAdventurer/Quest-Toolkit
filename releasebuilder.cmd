call echo "Preparing to build release"
mkdir builds
call npm install
call pkg .\index.js
call move index-linux .\builds\Quest-Toolkit-Linux
call move index-macos .\builds\Quest-Toolkit-OSX
call move index-win.exe .\builds\Quest-Toolkit-Windows.exe
call cd builds
call bestzip Quest-Toolkit-Linux.zip .\Quest-Toolkit-Linux .\README.md
call bestzip Quest-Toolkit-OSX.zip .\Quest-Toolkit-OSX .\README.md
call bestzip Quest-Toolkit-Windows.zip .\Quest-Toolkit-Windows.exe .\README.md
call del Quest-Toolkit-Linux
call del Quest-Toolkit-OSX


