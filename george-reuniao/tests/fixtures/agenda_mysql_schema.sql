CREATE TABLE empresa (
  id BIGINT PRIMARY KEY,
  nome_fantasia VARCHAR(180) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuario (
  id BIGINT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuario_empresa (
  usuario_id BIGINT NOT NULL,
  empresa_id BIGINT NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  empresa_padrao TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE colaborador (
  id BIGINT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  nome VARCHAR(180) NOT NULL,
  status ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO',
  tipo ENUM('EFETIVO') NULL,
  cadastro_status ENUM('CADASTRADO') NULL,
  origem_cadastro ENUM('CADASTRO') NULL,
  funcao VARCHAR(180) NULL,
  cargo VARCHAR(180) NULL,
  KEY idx_colaborador_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE colaborador_alias (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  colaborador_id BIGINT NOT NULL,
  alias VARCHAR(180) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_alias_empresa (empresa_id, alias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE veiculo (
  id BIGINT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  placa VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agenda_dia (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  data_agenda DATE NOT NULL,
  status ENUM('PLANEJADA') NOT NULL DEFAULT 'PLANEJADA',
  versao_rascunho BIGINT NOT NULL DEFAULT 0,
  origem_agenda_semanal_ref VARCHAR(255) NULL,
  finalizado_em DATETIME NULL,
  finalizado_por_usuario_id BIGINT NULL,
  snapshot_json_path VARCHAR(255) NULL,
  snapshot_json_sha256 VARCHAR(64) NULL,
  UNIQUE KEY uq_agenda_dia_empresa_data (empresa_id, data_agenda)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agenda_dia_colaborador (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  agenda_dia_id BIGINT NOT NULL,
  colaborador_id BIGINT NOT NULL,
  cargo_snapshot VARCHAR(180) NULL,
  funcao_snapshot VARCHAR(180) NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  removido_em DATETIME NULL,
  UNIQUE KEY uq_agenda_colaborador (empresa_id, agenda_dia_id, colaborador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agenda_dia_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  agenda_dia_id BIGINT NOT NULL,
  agenda_dia_colaborador_id BIGINT NOT NULL,
  item_origem_id BIGINT NULL,
  origem_tipo ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  operacao_origem ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  origem_agenda_semanal_ref VARCHAR(255) NULL,
  obra_texto VARCHAR(255) NOT NULL DEFAULT '',
  local_texto VARCHAR(255) NOT NULL DEFAULT '',
  atividade_texto VARCHAR(255) NOT NULL DEFAULT '',
  viagem TINYINT(1) NOT NULL DEFAULT 0,
  veiculo_id BIGINT NULL,
  cronograma_existe TINYINT(1) NOT NULL DEFAULT 1,
  status_item ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  status_execucao ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  percentual_realizado DECIMAL(5,2) NULL,
  motivo_nao_conclusao TEXT NULL,
  motivo_cancelamento TEXT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_item_dia (empresa_id, agenda_dia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE agenda_dia_evento (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT NOT NULL,
  agenda_dia_id BIGINT NOT NULL,
  usuario_id BIGINT NOT NULL,
  origem_acao ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  transacao_id VARCHAR(80) NOT NULL,
  versao_rascunho BIGINT NOT NULL,
  tipo_evento ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  entidade_tipo ENUM('LEGADO') NOT NULL DEFAULT 'LEGADO',
  entidade_id BIGINT NULL,
  dados_json LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
