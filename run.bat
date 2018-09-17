@echo off
cd %~dp0
if NOT exist "%SystemDrive%\Program Files\nodejs" (
	if NOT exist "%SystemDrive%\Program Files (x86)\nodejs" (
		if NOT exist cache.txt (
			echo Cannot finf Node.js in Program Files. Have you installed it?
			echo 1.Yes
			echo 2.No, and install it
			echo 3.I will install it by myself
			set /p a=
			if a==1 echo>>cache.txt&&goto start
			if a==2 goto install
			if a==3 echo Press any keys after installing is finished&&pause>nul
		)
	)
)
:start
if NOT exist %appdata%\npm\node_modules\nodemon echo Cannot find nodemon, installing&&npm install -g nodemon
nodemon fgo.js
:install
echo installing
msiexec /quiet /qf node.msi
call %0