<?php
// Coloque este arquivo em /api/gerador/check_storage.php e acesse no navegador.
// Ele verifica (e tenta criar) as pastas configuradas no config.php e testa escrita.
header('Content-Type: text/plain; charset=utf-8');
require __DIR__ . '/config.php';

function line($s){ echo $s . "\n"; }

line("== ERP IMPAR | Verificação de storage ==");
$dirs = [PDF_DIR, dirname(CSV_FILE), JSONL_DIR];

foreach ($dirs as $d){
  $exists = is_dir($d);
  if (!$exists){
    @mkdir($d, 0775, true);
    $exists = is_dir($d);
  }
  $perm = $exists ? substr(sprintf('%o', fileperms($d)), -4) : '----';
  $writable = $exists ? is_writable($d) : false;
  line("Dir: $d");
  line(" - existe: " . ($exists ? "SIM" : "NÃO"));
  line(" - permissão: " . $perm);
  line(" - gravável: " . ($writable ? "SIM" : "NÃO"));
  line("");
}

// testa escrita em docs
$testFile = rtrim(PDF_DIR, '/').'/test_write.txt';
$ok = @file_put_contents($testFile, "ok @ ".date('c'));
line("Teste de escrita em PDF_DIR: " . ($ok !== false ? "OK ($testFile)" : "FALHOU"));
line("");
line("Se falhar, ajuste as permissões via painel/FTP para 775 nas pastas de storage.");
line("Depois APAGUE este arquivo por segurança.");
