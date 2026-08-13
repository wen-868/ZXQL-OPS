$files = @(
  'D:\Users\ZXQL\ZXQL-OPS\release-assets\start.ps1',
  'D:\Users\ZXQL\ZXQL-OPS\build-release.ps1'
)
foreach ($f in $files) {
  $tok = $null
  $err = $null
  [System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$tok, [ref]$err)
  if ($err.Count -eq 0) { Write-Host ("OK: " + $f) }
  else {
    Write-Host ("SYNTAX ERR in " + $f)
    $err | ForEach-Object { Write-Host $_.Message }
  }
}
