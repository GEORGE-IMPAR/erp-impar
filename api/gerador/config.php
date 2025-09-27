<?php
// api/gerador/config.php  — FLAT-FILE (sem MySQL)
define('API_TOKEN', 'TROQUE_POR_UM_TOKEN_BEM_LONGO'); // ex.: Xk93... (min 32 chars)

// Diretórios (ajuste se quiser mover para fora da pasta pública)
define('PDF_DIR', __DIR__ . '/../../storage/docs');      // onde salvam os PDFs
define('CSV_FILE', __DIR__ . '/../../storage/data/regs.csv'); // base CSV
define('JSONL_DIR', __DIR__ . '/../../storage/logs');    // 1 arquivo por dia em JSON Lines

// URL pública para acessar os PDFs
define('PDF_BASE_URL', 'https://www.erpimpar.com.br/storage/docs');

// Campos fixos no CSV (na mesma ordem do save.php)
$GLOBALS['CSV_HEADERS'] = [
  'created_at','codigo','servico','endereco_obra',
  'contratante_nome','contratante_doc','contratante_endereco','contratante_contato','contratante_tel','contratante_email',
  'contratada_nome','contratada_doc','contratada_endereco','contratada_contato','contratada_tel','contratada_email',
  'valor','valor_extenso','prazo_dias','data_extenso','operador_nome','operador_email','pdf_file','pdf_url','ip','user_agent'
];
