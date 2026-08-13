$files = @(
  'd:\Users\ZXQL\ZXQL-OPS\build-release.ps1',
  'd:\Users\ZXQL\ZXQL-OPS\release-assets\start.ps1',
  'd:\Users\ZXQL\ZXQL-OPS\make-exe.ps1'
)
foreach ($f in $files) {
  $t = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
  [System.IO.File]::WriteAllText($f, $t, [System.Text.Encoding]::UTF8)
  Write-Host ("BOM added: " + $f)
}
