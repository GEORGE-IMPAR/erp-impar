/**
 * GESTÃO DE PROJETOS - JavaScript (ERP ÍMPAR)
 * Arquivo: www.erpimpar.com.br/tv/js/gestao_projetos.js
 */

// ========================================
// CONFIGURAÇÃO
// ========================================

const API_CONFIG = {
    // URL da API no Kinghost
    BASE_URL: 'https://api.erpimpar.com.br/tv',
    
    // Endpoints
    LISTAR: '/listar.php',
    ATUALIZAR: '/atualizar.php',
    
    // Timeout de requisições (ms)
    TIMEOUT: 10000
};

// ========================================
// FUNÇÕES DE API
// ========================================

async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include', // Inclui cookies se necessário
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
        
        return data.data.projetos;
        
    } catch (error) {
        console.error('Erro ao listar projetos:', error);
        throw error;
    }
}

async function atualizarProjeto(dados) {
    try {
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

function fecharLoading() {
    if (typeof Swal !== 'undefined') {
        Swal.close();
    }
}

function getFarolEmoji(farol) {
    const emojis = {
        'verde': '🟢',
        'amarelo': '🟡',
        'vermelho': '🔴'
    };
    return emojis[farol] || '⚪';
}

function getFarolColor(farol) {
    const cores = {
        'verde': '#22c55e',
        'amarelo': '#fbbf24',
        'vermelho': '#ef4444'
    };
    return cores[farol] || '#9ca3af';
}