Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShortcut = WshShell.CreateShortcut(strDesktop & "\Cryo.lnk")

oShortcut.TargetPath = "wscript.exe"
oShortcut.Arguments = """C:\Users\Devansh Tyagi\Desktop\Projects\Cryo\Launch_Cryo_Silently.vbs"""
oShortcut.WorkingDirectory = "C:\Users\Devansh Tyagi\Desktop\Projects\Cryo"
oShortcut.IconLocation = "C:\Users\Devansh Tyagi\Desktop\Projects\Cryo\app.ico, 0"
oShortcut.Description = "Cryo Control Center"
oShortcut.Save

WScript.Echo "Shortcut created: " & strDesktop & "\Cryo.lnk"
