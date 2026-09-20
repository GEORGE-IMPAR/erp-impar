<?php
declare(strict_types=1);

/*
 * ERP ÍMPAR / GEORGE — exportação segura para diagnóstico.
 * Instalar temporariamente em /george-reuniao/v09/.
 * Requer sessão ativa e usuário administrador do GEORGE.
 * Não inclui originais, chunks, áudio, vídeo, imagens ou PDFs.
 * Remover este arquivo do servidor após concluir os downloads.
 */

require __DIR__.'/lib/Core.php';

use function GeorgeV09\{actor, bootHttp, encode, readJson, recordDir, storeRoot};
use GeorgeV09\Failure;

// Lotes pequenos evitam timeout no painel/servidor e permitem trazer o Records
// progressivamente. Arquivos textuais grandes são divididos sem perda de bytes.
const RECORDS_PER_BATCH = 25;
const FILE_PART_BYTES = 1048576; // 1 MiB por parte
const ALLOWED_FILES = [
    'record.json',
    'transcript.txt',
    'queue-stop.json',
    'derived_manifest.json',
];

function failPage(string $message, int $status = 500): never {
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function recordPaths(): array {
    $paths = glob(storeRoot().'/records/*/record.json') ?: [];
    usort($paths, static function (string $a, string $b): int {
        // Não abra todos os JSON apenas para ordenar: em Records grandes isso era
        // uma das causas de lentidão e timeout. O desempate por caminho mantém a
        // paginação determinística enquanto o conjunto não muda.
        return (filemtime($b) <=> filemtime($a)) ?: strcmp($a, $b);
    });
    return $paths;
}

function addTextFile(ZipArchive $zip, string $source, string $target, array &$files): void {
    $size = filesize($source);
    if ($size === false) return;
    $sha = hash_file('sha256', $source) ?: null;
    $parts = max(1, (int)ceil($size / FILE_PART_BYTES));
    if ($parts === 1) {
        $zip->addFile($source, $target);
        $files[] = ['path' => $target, 'bytes' => $size, 'sha256' => $sha, 'parts' => 1];
        return;
    }
    $handle = fopen($source, 'rb');
    if ($handle === false) return;
    for ($part = 1; $part <= $parts; $part++) {
        $bytes = fread($handle, FILE_PART_BYTES);
        if ($bytes === false) break;
        $partName = sprintf('%s.part%04d-of-%04d', $target, $part, $parts);
        $zip->addFromString($partName, $bytes);
    }
    fclose($handle);
    $files[] = [
        'path' => $target,
        'bytes' => $size,
        'sha256' => $sha,
        'parts' => $parts,
        'rebuild' => 'Concatenar as partes em ordem binária para reconstruir o arquivo original.',
    ];
}

function publicSummary(array $record): array {
    return [
        'id' => (string)($record['id'] ?? ''),
        'kind' => (string)($record['kind'] ?? ''),
        'company_id' => (int)($record['company_id'] ?? 0),
        'owner_id' => (string)($record['owner_id'] ?? ''),
        'created_at' => $record['created_at'] ?? null,
        'updated_at' => $record['updated_at'] ?? null,
        'status' => $record['status'] ?? null,
        'job_state' => $record['job_state'] ?? null,
        'revision' => (int)($record['revision'] ?? 0),
        'name' => $record['meta']['name'] ?? null,
        'source_record_id' => $record['meta']['source_record_id'] ?? null,
        'segments_done' => (int)($record['next_segment'] ?? 0),
        'segments_total' => (int)($record['segments'] ?? 0),
        'report_parts_done' => count($record['report_parts'] ?? []),
        'report_parts_total' => count($record['report_inputs'] ?? []),
        'batch_stage' => $record['batch_stage'] ?? null,
        'batch_done' => (int)($record['batch_done'] ?? 0),
        'batch_total' => (int)($record['batch_total'] ?? 0),
        'last_error' => $record['last_error'] ?? null,
    ];
}

try {
    bootHttp(['GET']);
    $user = actor(false);
    if (empty($user['admin'])) {
        throw new Failure('ADMIN_OBRIGATORIO', 'Somente um administrador pode exportar o diagnóstico.', 403);
    }

    $paths = recordPaths();
    $total = count($paths);
    $batches = max(1, (int)ceil($total / RECORDS_PER_BATCH));
    $batch = filter_input(INPUT_GET, 'batch', FILTER_VALIDATE_INT);

    if ($batch === false || $batch === null) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">';
        echo '<title>GEORGE — exportar diagnóstico</title>';
        echo '<style>body{font-family:system-ui;margin:32px;max-width:780px;color:#17394b}a{display:block;margin:10px 0;padding:13px 16px;border-radius:12px;background:#087e70;color:#fff;text-decoration:none;font-weight:700}.note{padding:14px;border-radius:12px;background:#eef6f7}</style>';
        echo '<h1>Exportar diagnóstico do GEORGE</h1>';
        echo '<p class="note">Foram encontrados '.htmlspecialchars((string)$total).' registros. Os pacotes não incluem vídeos, áudios, imagens, chunks ou PDFs.</p>';
        for ($i = 1; $i <= $batches; $i++) {
            $start = (($i - 1) * RECORDS_PER_BATCH) + 1;
            $end = min($i * RECORDS_PER_BATCH, $total);
            echo '<a href="?batch='.$i.'">Baixar lote '.$i.' — registros '.$start.' a '.$end.'</a>';
        }
        echo '<p>Depois de baixar todos os lotes, remova este PHP do servidor.</p>';
        exit;
    }

    if ($batch < 1 || $batch > $batches) {
        failPage('Lote inválido.', 404);
    }
    if (!class_exists('ZipArchive')) {
        failPage('A extensão ZipArchive não está disponível no servidor.', 503);
    }

    $selected = array_slice($paths, ($batch - 1) * RECORDS_PER_BATCH, RECORDS_PER_BATCH);
    $temp = tempnam(sys_get_temp_dir(), 'george_records_');
    if ($temp === false) failPage('Não foi possível criar o arquivo temporário.');
    $zipPath = $temp.'.zip';
    @unlink($temp);
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        failPage('Não foi possível iniciar o ZIP.');
    }

    $manifest = [
        'generated_at' => date(DATE_ATOM),
        'batch' => $batch,
        'batches' => $batches,
        'records_in_batch' => count($selected),
        'total_records' => $total,
        'files_policy' => ALLOWED_FILES,
        'records_per_batch' => RECORDS_PER_BATCH,
        'file_part_bytes' => FILE_PART_BYTES,
        'records' => [],
        'files' => [],
    ];

    foreach ($selected as $recordPath) {
        $record = readJson($recordPath, []);
        $id = (string)($record['id'] ?? basename(dirname($recordPath)));
        if (!preg_match('/^g09_[a-f0-9]{32}$/D', $id)) continue;
        $dir = dirname($recordPath);
        foreach (ALLOWED_FILES as $name) {
            $source = $dir.'/'.$name;
            if (is_file($source) && !is_link($source)) {
                addTextFile($zip, $source, 'records/'.$id.'/'.$name, $manifest['files']);
            }
        }
        $manifest['records'][] = publicSummary($record);
    }
    $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $zip->close();

    $download = sprintf('GEORGE_RECORDS_DIAGNOSTICO_%02d_DE_%02d.zip', $batch, $batches);
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="'.$download.'"');
    header('Content-Length: '.filesize($zipPath));
    header('Cache-Control: private, no-store');
    readfile($zipPath);
    @unlink($zipPath);
    exit;
} catch (Throwable $e) {
    $status = $e instanceof Failure ? $e->http : 500;
    failPage($e->getMessage(), $status);
}
