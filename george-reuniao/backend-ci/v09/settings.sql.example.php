<?php
/**
 * Não substitua settings.local.php por este arquivo.
 * Acrescente somente a chave abaixo ao array já existente, depois que:
 * 1. agenda_install_check retornar ok=true;
 * 2. agenda_install concluir;
 * 3. agenda_bootstrap_preview for conferido;
 * 4. agenda_bootstrap_commit retornar verified=true.
 */
return [
    'agenda_backend' => 'sql',
];
