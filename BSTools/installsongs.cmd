SET JARSIGNERLOC="c:\Program Files\Android\Android Studio\jre\bin\jarsigner.exe"
erase /s /Q .\apk\base
.\tools\adb.exe pull /data/app/com.beatgames.beatsaber-1/base.apk
echo n | copy /-y base.apk .\backup\
java -jar .\tools\apktool_2.4.0.jar d .\base.apk -o .\apk\base -f
echo n | copy /-y .\apk\base\lib\armeabi-v7a\libil2cpp.so .\backup\
.\tools\songe-converter.exe -a ..\CustomSongFiles
.\tools\BeatMapAssetMaker.exe --patch .\apk\base\lib\armeabi-v7a\libil2cpp.so
.\tools\BeatMapAssetMaker.exe .\apk\base\assets\bin\Data\ .\assets\ .\ToConvert\ covers
erase /Q .\apk\base\assets\bin\Data\sharedassets17.assets
erase /Q .\apk\base\assets\bin\Data\sharedassets17.assets.split*
erase /Q .\apk\base\assets\bin\Data\sharedassets19.assets
erase /Q .\apk\base\assets\bin\Data\sharedassets19.assets.split*
copy .\assets\*.* .\apk\base\assets\bin\Data\
java -jar .\tools\apktool_2.4.0.jar b .\apk\base
%JARSIGNERLOC% -storepass emulamer -keypass emulamer -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore bskey .\apk\base\dist\base.apk bs 
.\tools\adb.exe uninstall com.beatgames.beatsaber
.\tools\adb.exe install .\apk\base\dist\base.apk


