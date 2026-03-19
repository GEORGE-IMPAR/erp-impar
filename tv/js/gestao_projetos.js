/**
 * GESTÃO DE PROJETOS - JavaScript (versão JSON)
 * Arquivo: js/gestao_projetos.js
 * Comunicação com backend PHP que trabalha com JSON
 */

// ========================================
// CONFIGURAÇÃO
// ========================================

const API_CONFIG = {
    // SUBSTITUIR pela URL real do seu Kinghost
    BASE_URL: 'https://www.erpimpar.com.br/api',
    
    // Endpoints
    LISTAR: '/listar.php',
    ATUALIZAR: '/atualizar.php',
    
    // Timeout de requisições (ms)
    TIMEOUT: 10000
};

// ========================================
// FUNÇÕES DE API
// ========================================

/**
 * Fazer requisição HTTP com timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Tempo de requisição excedido');
        }
        throw error;
    }
}

/**
 * Listar projetos do backend
 */
async function listarProjetos() {
    try {
        const url = API_CONFIG.BASE_URL + API_CONFIG.LISTAR;
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido ao listar projetos');
        }
        
        return data.data.projetos; // Retorna array de projetos
        
    } catch (error) {
        console.error('Erro ao listar projetos:', error);
        throw error;
    }
}

/**
 * Atualizar projeto no backend
 */
async function atualizarProjeto(dados) {
    try {
        // Validação básica
        if (!dados.projeto_id || !dados.status || !dados.execucao || !dados.farol) {
            throw new Error('Dados incompletos para atualizar projeto');
        }
        
        const url = API_CONFIG.BASE_URL + API_CONFIG.ATUALIZAR;
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido ao atualizar projeto');
        }
        
        return data;
        
    } catch (error) {
        console.error('Erro ao atualizar projeto:', error);
        throw error;
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Mostrar notificação de sucesso
 */
function mostrarSucesso(titulo, mensagem) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: titulo,
            text: mensagem,
            confirmButtonColor: '#22c55e'
        });
    } else {
        alert(`${titulo}\n${mensagem}`);
    }
}

/**
 * Mostrar notificação de erro
 */
function mostrarErro(titulo, mensagem) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensagem,
            confirmButtonColor: '#ef4444'
        });
    } else {
        alert(`${titulo}\n${mensagem}`);
    }
}

/**
 * Mostrar loading
 */
function mostrarLoading(mensagem = 'Carregando...') {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: mensagem,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }
}

/**
 * Fechar loading
 */
function fecharLoading() {
    if (typeof Swal !== 'undefined') {
        Swal.close();
    }
}

/**
 * Obter emoji do farol
 */
function getFarolEmoji(farol) {
    const emojis = {
        'verde': '🟢',
        'amarelo': '🟡',
        'vermelho': '🔴'
    };
    return emojis[farol] || '⚪';
}

/**
 * Obter cor do farol
 */
function getFarolColor(farol) {
    const cores = {
        'verde': '#22c55e',
        'amarelo': '#fbbf24',
        'vermelho': '#ef4444'
    };
    return cores[farol] || '#9ca3af';
}