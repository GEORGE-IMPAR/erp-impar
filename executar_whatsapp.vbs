Set objExcel = CreateObject("Excel.Application")
objExcel.Application.Visible = False
objExcel.Application.Run "'C:\IMPAR\agenda_diaria.xlsm'!AutoExecutarPython"
objExcel.DisplayAlerts = False
objExcel.Quit
Set objExcel = Nothing