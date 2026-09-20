<?php
declare(strict_types=1);

/** Adaptador mínimo e exclusivamente sintético para o CI. */
function mobile_users_rows(): array {
    return [[
        'id' => 'ci-user',
        'nome' => 'Usuário CI',
        'email' => 'ci@erpimpar.invalid',
        'senhaHash' => password_hash('Teste-CI-George-2026', PASSWORD_DEFAULT),
        'ativo' => true,
        'perfil' => 'administrador',
        'modulos' => ['admin', 'atividades'],
    ]];
}

function mobile_user_key(array $user): string {
    return hash('sha256', strtolower((string)($user['email'] ?? 'ci@erpimpar.invalid')));
}

function mobile_conv_load(string $key): array {
    return ['messages' => [], 'updatedAt' => date(DATE_ATOM)];
}

