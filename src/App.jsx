import { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  User,
  Users,
  CreditCard,
  CheckCircle2,
  LogOut,
  LogIn,
  Trash2,
  FileSpreadsheet,
  Edit2,
  Settings,
  KeyRound,
} from 'lucide-react';
import bcrypt from 'bcryptjs';
import './App.css';
import Login from './Login';

const API_URL = '/api';

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
};

function App() {
  // Estado para o usuário logado (simulado via localStorage)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  // Estado para armazenar os registros de ponto vindos do Firestore
  const [logs, setLogs] = useState([]);

  // Estado para a logo do sistema
  const [logo, setLogo] = useState(() => {
    return localStorage.getItem('appLogo') || '';
  });

  // Estado para controlar a visualização atual (register, reports, settings)
  const [view, setView] = useState('register');

  // Estado para os filtros de relatório
  const [reportFilters, setReportFilters] = useState({
    name: '',
    startDate: '',
    endDate: '',
    month: new Date().toISOString().slice(0, 7) // Para a ficha oficial
  });

  const [reportType, setReportType] = useState('dynamic'); // 'dynamic' ou 'official'

  // Dados extras para a ficha oficial
  const [officialData, setOfficialData] = useState({
    matricula: '',
    setor: '', // Adicionado setor para permitir nome longo (ex: PGDP/Coordenação...)
    ramal: '',
    chefe: '',
    matriculaChefe: ''
  });

  // Estado para colunas dinâmicas
  const [reportColumns, setReportColumns] = useState({
    date: true,
    name: true,
    role: true,
    entryTime: true,
    lunchStart: true,
    lunchEnd: true,
    exitTime: true,
    status: true,
    totalHours: true
  });

  // Estado para edição
  const [editingId, setEditingId] = useState(null);

  // Estado para configurações globais
  const [enableLunchBreak, setEnableLunchBreak] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({ host: '', port: 587, user: '', pass: '', from: '', proxy: '' });
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [recentFilters, setRecentFilters] = useState({ date: '', name: '' });
  const [showJustification, setShowJustification] = useState(true);

  // Estado para trocar senha
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '' });
  const [passwordMsg, setPasswordMsg] = useState('');

  // Estado para gerenciar usuários (admin)
  const [allUsers, setAllUsers] = useState([]);

  // Dados do formulário de registro
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: '',
    funcao: '',
    date: new Date().toISOString().split('T')[0],
    entryTime: '',
    lunchStart: '',
    lunchEnd: '',
    exitTime: '',
    justification: ''
  });

  /**
   * Efeito para observar e persistir o usuário logado.
   */
  useEffect(() => {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [user]);

  /**
   * Efeito para carregar usuários quando o admin acessar a aba correspondente.
   */
  useEffect(() => {
    if (view === 'users' && user?.role === 'admin') {
      fetchUsers();
    }
  }, [view, user]);

  /**
   * Efeito para buscar logs iniciais
   */
  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) return;
      try {
        // Se for admin, busca tudo. Se for usuário comum, busca apenas os próprios registros
        const queryParam = user.role === 'admin' ? '' : `?userId=${user.id}`;
        const res = await apiFetch(`${API_URL}/logs${queryParam}`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setLogs(data);

          // Auto-preencher Nome e Setor baseado no último registro do usuário
          if (user.role === 'user' && data.length > 0) {
            const lastLog = data[0];
            setFormData(prev => ({
              ...prev,
              name: prev.name || lastLog.name,
              role: prev.role || lastLog.role,
              funcao: prev.funcao || lastLog.funcao || ''
            }));
          }
        } else {
          console.error("Erro na API (logs):", data);
          setLogs([]);
        }
      } catch (error) {
        console.error("Erro ao buscar logs iniciais: ", error);
      }
    };

    fetchLogs();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`${API_URL}/settings`);
        if (res.ok) {
          const data = await res.json();
          setEnableLunchBreak(data.enableLunchBreak || false);
          setSmtpConfig({
            host: data.smtpHost || '',
            port: data.smtpPort || 587,
            user: data.smtpUser || '',
            pass: '', // Pass is hidden
            from: data.smtpFrom || '',
            proxy: data.smtpProxy || ''
          });
        }
      } catch (error) {
        console.error("Erro ao buscar configurações globais: ", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('appLogo', logo);
  }, [logo]);

  /**
   * Manipula o upload da logo com validação básica de segurança
   */
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validação de tipo de arquivo (Segurança)
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }
      // Validação de tamanho (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Efeito para auto-carregar o registro do dia, evitando duplicação
   */
  useEffect(() => {
    if (user && view === 'register' && user.role === 'user') {
      const existingLog = logs.find(l => l.userId === user.id && l.date === formData.date);
      if (existingLog) {
        setFormData({
          name: existingLog.name,
          role: existingLog.role,
          funcao: existingLog.funcao || '',
          date: existingLog.date,
          entryTime: existingLog.entryTime || '',
          lunchStart: existingLog.lunchStart || '',
          lunchEnd: existingLog.lunchEnd || '',
          exitTime: existingLog.exitTime || '',
          justification: existingLog.justification || ''
        });
        setEditingId(existingLog.id);
      } else {
        setEditingId(null);
      }
    }
  }, [formData.date, logs, user, view]);

  /**
   * Atualiza o estado do formulário conforme o usuário digita
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Sanitização básica: remover caracteres potencialmente perigosos
    const sanitizedValue = value.replace(/[<>]/g, '');
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
  };

  /**
   * Registra o ponto automaticamente para usuários comuns
   */
  
  
  const handleAutomaticPunch = async (e) => {
    if (e) e.preventDefault();
    
    // Agora pegamos o nome e setor do próprio usuário logado
    const userName = user.name || user.email;
    const userRole = user.setor || 'Servidor';
    const userFuncao = user.funcao || '';

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const queryParam = user.role === 'admin' ? '' : `?userId=${user.id}`;
      const res = await apiFetch(`${API_URL}/logs${queryParam}`);
      const logsResponse = await res.json();
      
      // Encontra o registro de hoje deste usuário
      const todayLog = logsResponse.find(l => l.userId === user.id && l.date === today);

      if (!todayLog) {
        // Primeira batida: Entrada
        const newLog = {
          id: crypto.randomUUID(),
          name: userName,
          role: userRole,
          funcao: userFuncao,
          date: today,
          entryTime: nowTime,
          status: 'pending'
        };
        const createRes = await apiFetch(`${API_URL}/logs`, {
          method: 'POST',
          body: JSON.stringify(newLog)
        });
        if (!createRes.ok) throw new Error('Falha ao registrar entrada');
        alert(`Entrada registrada com sucesso às ${nowTime}!`);
      } else {
        if (enableLunchBreak) {
          // 4 cliques: Entrada -> Ida Almoço -> Volta Almoço -> Saída
          if (!todayLog.lunchStart) {
            const updatedLog = { ...todayLog, lunchStart: nowTime };
            const updateRes = await apiFetch(`${API_URL}/logs/${todayLog.id}`, { method: 'PUT', body: JSON.stringify(updatedLog) });
            if (!updateRes.ok) throw new Error('Falha ao atualizar ponto');
            alert(`Ida para o almoço registrada com sucesso! (${nowTime})`);
          } else if (!todayLog.lunchEnd) {
            const updatedLog = { ...todayLog, lunchEnd: nowTime };
            const updateRes = await apiFetch(`${API_URL}/logs/${todayLog.id}`, { method: 'PUT', body: JSON.stringify(updatedLog) });
            if (!updateRes.ok) throw new Error('Falha ao atualizar ponto');
            alert(`Volta do almoço registrada com sucesso! (${nowTime})`);
          } else if (!todayLog.exitTime) {
            const updatedLog = { ...todayLog, exitTime: nowTime, status: 'completed' };
            const updateRes = await apiFetch(`${API_URL}/logs/${todayLog.id}`, { method: 'PUT', body: JSON.stringify(updatedLog) });
            if (!updateRes.ok) throw new Error('Falha ao atualizar ponto');
            alert(`Saída final registrada com sucesso! (${nowTime})`);
          } else {
            alert('Você já registrou todos os seus pontos de hoje!');
            return;
          }
        } else {
          // Segunda batida: Saída Final
          if (todayLog.exitTime) {
            alert('Você já registrou sua Entrada e Saída de hoje!');
            return;
          }

          const updatedLog = { ...todayLog, exitTime: nowTime, status: 'completed' };

          const updateRes = await apiFetch(`${API_URL}/logs/${todayLog.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatedLog)
          });
          
          if (!updateRes.ok) throw new Error('Falha ao atualizar ponto');
          alert(`Saída final registrada com sucesso! (${nowTime})`);
        }
      }

      // Atualiza a tabela na tela
      const refreshRes = await apiFetch(`${API_URL}/logs${queryParam}`);
      const newLogs = await refreshRes.json();
      if (Array.isArray(newLogs)) {
        setLogs(newLogs);
      }
    } catch (error) {
      console.error(error);
      alert('Ocorreu um erro ao bater o ponto automático.');
    }
  };

  /**
   * Salva um novo registro de ponto no servidor local (Modo Manual Admin)
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação de segurança e integridade
    if (!formData.name.trim() || !formData.role.trim() || !formData.date || !formData.entryTime) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, Cargo/Área, Data e Entrada).');
      return;
    }

    // Verifica se já existe um log neste dia para este usuário (se não for admin)
    let targetEditingId = editingId;
    if (user.role !== 'admin' && !targetEditingId) {
      const duplicateLog = logs.find(l => l.userId === user.id && l.date === formData.date);
      if (duplicateLog) {
        targetEditingId = duplicateLog.id;
      }
    }

    const newLog = {
      id: crypto.randomUUID(),
      ...formData,
      status: formData.exitTime ? 'completed' : 'pending',
      createdAt: new Date().toISOString(),
      userId: user.id // Associa o registro ao usuário
    };

    try {
      if (targetEditingId) {
        // Modo Edição
        const logIdToUpdate = targetEditingId;
        // Garantir que a requisição de PUT não modifique o ID ou o userId da original caso não queiramos
        newLog.id = logIdToUpdate;
        const res = await apiFetch(`${API_URL}/logs/${logIdToUpdate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLog)
        });
        if (!res.ok) throw new Error("Falha ao editar");
        setLogs(logs.map(log => log.id === logIdToUpdate ? newLog : log));
        setEditingId(null);
        alert('Ponto atualizado com sucesso!');
      } else {
        // Modo Criação
        const res = await apiFetch(`${API_URL}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLog)
        });
        if (!res.ok) throw new Error("Falha na requisição");
        setLogs([newLog, ...logs]);
        alert('Ponto registrado com sucesso!');
      }

      // Limpar campos de horário após salvar, mantendo nome e cargo
      setFormData({
        ...formData,
        entryTime: '',
        lunchStart: '',
        lunchEnd: '',
        exitTime: '',
        justification: ''
      });

    } catch (error) {
      console.error("Erro ao adicionar documento: ", error);
      alert("Erro ao salvar. Verifique se o json-server está rodando.");
    }
  };

  /**
   * Exclui um registro do banco de dados local
   */
  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      try {
        await apiFetch(`${API_URL}/logs/${id}`, { method: 'DELETE' });
        setLogs(logs.filter(log => log.id !== id));
      } catch (error) {
        console.error("Erro ao excluir documento: ", error);
        alert("Erro ao excluir.");
      }
    }
  };

  /**
   * Prepara o formulário para edição (Apenas Admin)
   */
  const handleEdit = (log) => {
    if (user.role !== 'admin') return;
    setFormData({
      name: log.name,
      role: log.role,
      funcao: log.funcao || '',
      date: log.date,
      entryTime: log.entryTime || '',
      lunchStart: log.lunchStart || '',
      lunchEnd: log.lunchEnd || '',
      exitTime: log.exitTime || '',
      justification: log.justification || ''
    });
    setEditingId(log.id);
    setView('register');
    window.scrollTo(0, 0);
  };

  /**
   * Faz o logout do usuário atual
   */
  const handleLogout = () => {
    setUser(null);
  };

  /**
   * Altera a senha do usuário logado
   */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    try {
      if (passwordForm.newPassword.length < 6) {
        setPasswordMsg('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }

      const res = await apiFetch(`${API_URL}/users/${user.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        setPasswordMsg(errorData.error || 'Erro ao alterar senha.');
        return;
      }

      setPasswordMsg('Senha alterada com sucesso!');
      setPasswordForm({ oldPassword: '', newPassword: '' });
    } catch (error) {
      console.error(error);
      setPasswordMsg('Erro ao alterar senha.');
    }
  };

  /**
   * Funções de Gerenciamento de Usuários (Admin)
   */
  const fetchUsers = async () => {
    try {
      const res = await apiFetch(`${API_URL}/users`);
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  };

  const handleDeleteUser = async (id) => {
    if (id === user.id) {
      alert("Você não pode excluir sua própria conta.");
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        const res = await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setAllUsers(allUsers.filter(u => u.id !== id));
        }
      } catch (error) {
        console.error("Erro ao excluir usuário:", error);
      }
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === user.id) {
      alert("Você não pode alterar sua própria permissão por aqui.");
      return;
    }
    try {
      const res = await apiFetch(`${API_URL}/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      }
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error);
    }
  };

  // Função auxiliar para capturar a hora do sistema
  const setSystemTime = (field) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setFormData(prev => ({ ...prev, [field]: timeString }));
  };

  // Cálculo de Horas
  const calculateHours = (entry, exit, lStart, lEnd) => {
    if (!entry || !exit) return '--:--';
    const [h1, m1] = entry.split(':').map(Number);
    const [h2, m2] = exit.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60; // cruza meia noite

    // Subtrai almoço se houver
    if (lStart && lEnd) {
      const [lh1, lm1] = lStart.split(':').map(Number);
      const [lh2, lm2] = lEnd.split(':').map(Number);
      let lDiff = (lh2 * 60 + lm2) - (lh1 * 60 + lm1);
      if (lDiff > 0) {
        diff -= lDiff;
      }
    }

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  };

  const showCalculationDetails = (log) => {
    if (!log.exitTime) {
      alert("Cálculo indisponível: O servidor ainda não registrou a saída.");
      return;
    }
    const total = calculateHours(log.entryTime, log.exitTime, log.lunchStart, log.lunchEnd);
    let msg = `Cálculo de Horas - ${log.name}\n\nEntrada: ${log.entryTime}\n`;
    if (log.lunchStart && log.lunchEnd) {
      msg += `Ida Almoço: ${log.lunchStart}\nVolta Almoço: ${log.lunchEnd}\n`;
    }
    msg += `Saída: ${log.exitTime}\n\nTotal de Horas Trabalhadas: ${total}`;
    alert(msg);
  };

  // Se não houver usuário logado, mostra a tela de Login
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  /**
   * Filtra os logs para o relatório dinâmico (por Período)
   */
  const filteredLogs = logs.filter(log => {
    const matchesName = log.name.toLowerCase().includes(reportFilters.name.toLowerCase());
    let matchesDate = true;
    if (reportType === 'dynamic') {
      if (reportFilters.startDate && reportFilters.endDate) {
        matchesDate = log.date >= reportFilters.startDate && log.date <= reportFilters.endDate;
      } else if (reportFilters.startDate) {
        matchesDate = log.date >= reportFilters.startDate;
      } else if (reportFilters.endDate) {
        matchesDate = log.date <= reportFilters.endDate;
      }
    } else {
      // Para o oficial, filtra apenas pelo mês/ano exato
      matchesDate = log.date.startsWith(reportFilters.month);
    }
    return matchesName && matchesDate;
  });

  // Função para mapear o mês numérico para texto
  const getMonthName = (monthStr) => {
    if (!monthStr) return '';
    const date = new Date(monthStr + '-01T00:00:00');
    return date.toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
  };

  // Gerador de array de 31 dias para a ficha oficial
  const renderOfficialDays = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      const dayStr = i.toString().padStart(2, '0');
      const log = filteredLogs.find(l => l.date === `${reportFilters.month}-${dayStr}`);

      let manhaE = '', manhaS = '', tardeE = '', tardeS = '', total = '';

      if (log) {
        // Regra simples: entryTime -> Manhã Entrada, lunchStart -> Manhã Saída
        // lunchEnd -> Tarde Entrada, exitTime -> Tarde Saída
        manhaE = log.entryTime || '';
        manhaS = log.lunchStart || (log.exitTime && !log.lunchStart && !log.lunchEnd && log.exitTime <= '13:00' ? log.exitTime : '');
        tardeE = log.lunchEnd || (log.entryTime >= '13:00' ? log.entryTime : '');
        tardeS = log.exitTime || '';

        // Se bateu ponto de tarde e não de manhã
        if (log.entryTime >= '13:00') {
          manhaE = '';
          tardeE = log.entryTime;
          tardeS = log.exitTime || '';
        }

        total = calculateHours(log.entryTime, log.exitTime, log.lunchStart, log.lunchEnd);
        if (total === '--:--') total = '';
      }

      days.push(
        <tr key={i}>
          <td className="center-text">{dayStr}</td>
          <td className="center-text">{manhaE}</td>
          <td className="center-text">{manhaS}</td>
          <td className="center-text">{tardeE}</td>
          <td className="center-text">{tardeS}</td>
          <td></td>
          <td></td>
          <td className="center-text">{total}</td>
          {showJustification && <td className="center-text" style={{ fontSize: '0.8rem' }}>{log?.justification || ''}</td>}
        </tr>
      );
    }
    return days;
  };

  // Lista única de nomes para o filtro
  const uniqueNames = [...new Set(logs.map(log => log.name))];

  /**
   * Função para imprimir o relatório
   */
  const handlePrint = () => {
    window.print();
  };

  const handleToggleLunchBreak = async (checked) => {
    try {
      const res = await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ enableLunchBreak: checked })
      });
      if (res.ok) {
        setEnableLunchBreak(checked);
        alert('Configuração de intervalo de almoço atualizada com sucesso!');
      } else {
        throw new Error('Falha ao atualizar configuração');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar configuração de almoço.');
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        smtpHost: smtpConfig.host,
        smtpPort: Number(smtpConfig.port),
        smtpUser: smtpConfig.user,
        smtpFrom: smtpConfig.from,
        smtpProxy: smtpConfig.proxy
      };
      if (smtpConfig.pass) {
        payload.smtpPass = smtpConfig.pass;
      }
      
      const res = await apiFetch(`${API_URL}/settings`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Configurações de SMTP salvas com sucesso!');
        setSmtpConfig(prev => ({ ...prev, pass: '' })); // clear password field
      } else {
        throw new Error('Falha ao salvar configurações de SMTP');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar SMTP.');
    }
  };

  return (
    <div className="app-container">
      <header className="app-header glass-panel no-print">
        <div className="logo-section">
          <div className="logo-container" title="Clique para alterar a logo">
            {logo ? (
              <img src={logo} alt="Logo da Instituição" className="logo-img" />
            ) : (
              <div className="logo-placeholder"><Clock size={32} /></div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="logo-upload-input"
            />
          </div>
          <div className="header-titles">
            <h1>Gestão de Frequência</h1>
            <p>
              Controle de Ponto
              <span style={{
                marginLeft: '8px',
                fontSize: '0.75rem',
                background: user.role === 'admin' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {user.role === 'admin' ? 'Administrador' : 'Usuário Padrão'}
              </span>
            </p>
          </div>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-btn ${view === 'register' ? 'active' : ''}`}
            onClick={() => setView('register')}
          >
            Registrar Ponto
          </button>
          {user.role === 'admin' && (
            <button
              className={`nav-btn ${view === 'reports' ? 'active' : ''}`}
              onClick={() => setView('reports')}
            >
              Relatórios
            </button>
          )}
          {user.role === 'admin' && (
            <button
              className={`nav-btn ${view === 'users' ? 'active' : ''}`}
              onClick={() => setView('users')}
              title="Gerenciar Usuários"
            >
              <Users size={18} />
            </button>
          )}
          <button
            className={`nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
            title="Configurações e Senha"
          >
            <Settings size={18} />
          </button>
          <button
            className="nav-btn"
            onClick={handleLogout}
            style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            title="Sair do Sistema"
          >
            <LogOut size={18} />
          </button>
        </nav>
      </header>

      <main className="main-content">
        {view === 'register' ? (
          <>
            <section className="form-panel glass-panel">
              <div className="panel-header">
                <Clock className="icon" size={24} />
                <h2>Registrar Ponto</h2>
              </div>

              {user.role === 'admin' ? (
                // FORMULÁRIO MANUAL PARA ADMINISTRADOR
                <>
                  <div style={{ padding: '15px', backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--accent-cyan)' }}>Montar Ambiente de Registro (Geral)</h3>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={enableLunchBreak}
                        onChange={(e) => handleToggleLunchBreak(e.target.checked)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>Exigir registro de intervalo de almoço (4 etapas) para todos os usuários</span>
                    </label>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div style={{ padding: '10px', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>Modo Administrador: Registro Manual</p>
                    </div>
                  <div className="form-group">
                    <label htmlFor="name">Nome Completo</label>
                    <div style={{ position: 'relative' }}>
                      <User className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Nome do colaborador"
                        style={{ paddingLeft: '40px', width: '100%' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="funcao">Função</label>
                    <div style={{ position: 'relative' }}>
                      <User className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        id="funcao"
                        name="funcao"
                        value={formData.funcao}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Ex: Desenvolvedor, Analista..."
                        style={{ paddingLeft: '40px', width: '100%' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="role">Área / Setor</label>
                    <div style={{ position: 'relative' }}>
                      <CreditCard className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Ex: Desenvolvimento, RH..."
                        style={{ paddingLeft: '40px', width: '100%' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="date">Data da Frequência</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="form-input"
                        style={{ paddingLeft: '40px', width: '100%' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="time-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="entryTime">Horário de Entrada</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <LogIn className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                          <input
                            type="time" id="entryTime" name="entryTime"
                            value={formData.entryTime} onChange={handleInputChange}
                            className="form-input" style={{ paddingLeft: '40px', width: '100%' }} required
                          />
                        </div>
                        <button type="button" onClick={() => setSystemTime('entryTime')} className="btn-print" style={{ padding: '0 12px' }} title="Usar hora atual do sistema">
                          <Clock size={16} /> Agora
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="lunchStart">Saída p/ Almoço</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <LogOut className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                          <input
                            type="time" id="lunchStart" name="lunchStart"
                            value={formData.lunchStart} onChange={handleInputChange}
                            className="form-input" style={{ paddingLeft: '40px', width: '100%' }}
                          />
                        </div>
                        <button type="button" onClick={() => setSystemTime('lunchStart')} className="btn-print" style={{ padding: '0 12px' }} title="Usar hora atual do sistema">
                          <Clock size={16} /> Agora
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="lunchEnd">Volta do Almoço</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <LogIn className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                          <input
                            type="time" id="lunchEnd" name="lunchEnd"
                            value={formData.lunchEnd} onChange={handleInputChange}
                            className="form-input" style={{ paddingLeft: '40px', width: '100%' }}
                          />
                        </div>
                        <button type="button" onClick={() => setSystemTime('lunchEnd')} className="btn-print" style={{ padding: '0 12px' }} title="Usar hora atual do sistema">
                          <Clock size={16} /> Agora
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="exitTime">Horário de Saída</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <LogOut className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                          <input
                            type="time" id="exitTime" name="exitTime"
                            value={formData.exitTime} onChange={handleInputChange}
                            className="form-input" style={{ paddingLeft: '40px', width: '100%' }}
                          />
                        </div>
                        <button type="button" onClick={() => setSystemTime('exitTime')} className="btn-print" style={{ padding: '0 12px' }} title="Usar hora atual do sistema">
                          <Clock size={16} /> Agora
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label htmlFor="justification">Justificativa (em caso de falta/ausência parcial)</label>
                    <div style={{ position: 'relative' }}>
                      <Edit2 className="icon" size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                      <input
                        type="text" id="justification" name="justification"
                        value={formData.justification} onChange={handleInputChange}
                        className="form-input" style={{ paddingLeft: '40px', width: '100%' }}
                        placeholder="Ex: Atestado Médico, Consulta, Falta Justificada"
                      />
                    </div>
                  </div>

                  <div className="form-actions" style={{ marginTop: '2rem' }}>
                    <button type="submit" className="btn-submit">
                      <CheckCircle2 size={20} />
                      {editingId ? 'Atualizar Ponto Manual' : 'Salvar Ponto Manual'}
                    </button>
                    {editingId && (
                      <button type="button" onClick={() => { setEditingId(null); setFormData({ name: '', role: '', date: new Date().toISOString().split('T')[0], entryTime: '', lunchStart: '', lunchEnd: '', exitTime: '', justification: '' }); }} className="btn-submit" style={{ marginTop: '10px', backgroundColor: 'var(--text-secondary)' }}>
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                </form>
                </>
              ) : (
                // MODO AUTOMÁTICO PARA USUÁRIO PADRÃO
                <form onSubmit={handleAutomaticPunch} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    <p>Olá, <strong>{user.name || user.email}</strong>!</p>
                    <p style={{ fontSize: '0.9rem' }}>Função: {user.funcao || 'Servidor'} | Setor: {user.setor || 'Não informado'}</p>
                  </div>
                  {(() => {
                    const today = new Date().toISOString().split('T')[0];
                    const todayLog = logs.find(l => l.userId === user.id && l.date === today);
                    let nextAction = 'Entrada';
                    if (todayLog) {
                      if (enableLunchBreak) {
                        if (!todayLog.lunchStart) nextAction = 'Ida Almoço';
                        else if (!todayLog.lunchEnd) nextAction = 'Volta Almoço';
                        else if (!todayLog.exitTime) nextAction = 'Saída';
                        else nextAction = 'Ponto Completo';
                      } else {
                        if (!todayLog.exitTime) nextAction = 'Saída';
                        else nextAction = 'Ponto Completo';
                      }
                    }
                    return (
                      <button 
                        type="submit" 
                        disabled={nextAction === 'Ponto Completo'}
                        className="btn-submit" 
                        style={{ 
                          height: '100px', 
                          fontSize: '1.5rem', 
                          borderRadius: '50px',
                          background: nextAction === 'Ponto Completo' ? 'var(--text-secondary)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                          boxShadow: nextAction === 'Ponto Completo' ? 'none' : '0 10px 25px rgba(6, 182, 212, 0.4)',
                          transition: 'transform 0.1s, box-shadow 0.1s',
                          width: '100%',
                          maxWidth: '450px',
                          cursor: nextAction === 'Ponto Completo' ? 'not-allowed' : 'pointer'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = nextAction === 'Ponto Completo' ? 'none' : 'scale(0.95)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Clock size={32} style={{ marginRight: '10px' }} />
                        {nextAction === 'Ponto Completo' ? 'Ponto Concluído' : `BATER PONTO: ${nextAction.toUpperCase()}`}
                      </button>
                    );
                  })()}
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginTop: '1rem' }}>
                    O sistema capturará a hora atual automaticamente na seguinte ordem:<br/>
                    <strong>{enableLunchBreak ? '1. Entrada → 2. Ida Almoço → 3. Volta Almoço → 4. Saída' : '1. Entrada → 2. Saída Final'}</strong>
                  </p>
                </form>
              )}
            </section>

            <section className="list-panel glass-panel">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet className="icon" size={24} />
                  <h2 style={{ margin: 0 }}>Registros Recentes</h2>
                </div>
                {user.role === 'admin' && (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input 
                      type="date" 
                      value={recentFilters.date} 
                      onChange={(e) => setRecentFilters({ ...recentFilters, date: e.target.value })}
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      title="Filtrar por data"
                    />
                    <select 
                      value={recentFilters.name}
                      onChange={(e) => setRecentFilters({ ...recentFilters, name: e.target.value })}
                      className="form-input"
                      style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      title="Filtrar por servidor"
                    >
                      <option value="">Todos os Servidores</option>
                      {[...new Set(logs.map(l => l.name))].map((n, i) => (
                        <option key={i} value={n}>{n}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={showPendingOnly}
                        onChange={(e) => setShowPendingOnly(e.target.checked)}
                      />
                      Apenas Incompletos
                    </label>
                  </div>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="empty-state">
                  <Clock size={48} opacity={0.5} />
                  <p>Nenhum registro de ponto encontrado.<br />Os novos registros aparecerão aqui.</p>
                </div>
              ) : (
                <div className="logs-table-container">
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Servidor</th>
                        <th>Função</th>
                        <th>Setor</th>
                        <th>Entrada</th>
                        {enableLunchBreak && <th>Intervalo de Almoço</th>}
                        <th>Saída</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs
                        .filter(l => showPendingOnly ? l.status !== 'completed' : true)
                        .filter(l => recentFilters.date ? l.date === recentFilters.date : true)
                        .filter(l => recentFilters.name ? l.name === recentFilters.name : true)
                        .slice(0, 50)
                        .map(log => (
                        <tr key={log.id}>
                          <td>{log.date.split('-').reverse().join('/')}</td>
                          <td>{log.name}</td>
                          <td>{log.funcao || '--'}</td>
                          <td>{log.role}</td>
                          <td>{log.entryTime}</td>
                          {enableLunchBreak && <td>{(log.lunchStart || '--:--') + ' - ' + (log.lunchEnd || '--:--')}</td>}
                          <td>{log.exitTime || '--:--'}</td>
                          <td>
                            <span className={`status-badge ${log.status}`}>
                              {log.status === 'completed' ? 'Finalizado' : 'Em Andamento'}
                            </span>
                          </td>
                          <td>
                            {user.role === 'admin' && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="delete-btn"
                                  onClick={() => handleEdit(log)}
                                  title="Editar registro"
                                  style={{ color: 'var(--accent-cyan)' }}
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  className="delete-btn"
                                  onClick={() => handleDelete(log.id)}
                                  title="Excluir registro"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : view === 'reports' && user.role === 'admin' ? (
          <section className="report-panel glass-panel">
            <div className="report-header-actions no-print">
              <div className="panel-header">
                <FileSpreadsheet className="icon" size={24} />
                <h2>Gerar Relatório Dinâmico</h2>
              </div>
              <div className="report-filters">
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', width: '100%' }}>
                  <button
                    className={`nav-btn ${reportType === 'dynamic' ? 'active' : ''}`}
                    onClick={() => setReportType('dynamic')}
                  >
                    Relatório Dinâmico
                  </button>
                  <button
                    className={`nav-btn ${reportType === 'official' ? 'active' : ''}`}
                    onClick={() => setReportType('official')}
                  >
                    Ficha Oficial UEFS
                  </button>
                </div>

                <div className="form-group">
                  <label>Servidor</label>
                  <select
                    className="form-input"
                    value={reportFilters.name}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setReportFilters({ ...reportFilters, name: selectedName });
                      const selectedUser = allUsers.find(u => (u.name || u.email) === selectedName);
                      if (selectedUser) {
                        setOfficialData(prev => ({
                          ...prev,
                          matricula: selectedUser.matricula || '',
                          setor: selectedUser.setor || '',
                          ramal: selectedUser.ramal || ''
                        }));
                      }
                    }}
                  >
                    <option value="">Selecione a pessoa...</option>
                    {allUsers.filter(u => u.role !== 'admin').map((u, i) => {
                      const displayName = u.name || u.email;
                      return <option key={i} value={displayName}>{displayName}</option>;
                    })}
                  </select>
                </div>

                {reportType === 'dynamic' ? (
                  <>
                    <div className="form-group">
                      <label>Data Inicial</label>
                      <input
                        type="date"
                        className="form-input"
                        value={reportFilters.startDate}
                        onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Data Final</label>
                      <input
                        type="date"
                        className="form-input"
                        value={reportFilters.endDate}
                        onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Mês/Ano Ref.</label>
                      <input
                        type="month"
                        className="form-input"
                        value={reportFilters.month}
                        onChange={(e) => setReportFilters({ ...reportFilters, month: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Matrícula</label>
                      <input
                        type="text" className="form-input" placeholder="Matrícula do Estag."
                        value={officialData.matricula} onChange={e => setOfficialData({ ...officialData, matricula: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Unidade/Setor</label>
                      <input
                        type="text" className="form-input" placeholder="Ex: PGDP/Coordenação..."
                        value={officialData.setor} onChange={e => setOfficialData({ ...officialData, setor: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Ramal</label>
                      <input
                        type="text" className="form-input" placeholder="Ramal"
                        value={officialData.ramal} onChange={e => setOfficialData({ ...officialData, ramal: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Chefe Imediato</label>
                      <input
                        type="text" className="form-input" placeholder="Nome do Chefe"
                        value={officialData.chefe} onChange={e => setOfficialData({ ...officialData, chefe: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Mat. do Chefe</label>
                      <input
                        type="text" className="form-input" placeholder="Matrícula do Chefe"
                        value={officialData.matriculaChefe} onChange={e => setOfficialData({ ...officialData, matriculaChefe: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', alignItems: 'flex-end' }}>
                  {reportType === 'official' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showJustification} onChange={e => setShowJustification(e.target.checked)} />
                      Exibir Justificativa
                    </label>
                  )}
                  <button className="btn-print" onClick={handlePrint} style={{ height: '42px' }}>
                    Imprimir
                  </button>
                </div>
              </div>

              {reportType === 'dynamic' && (
                <div className="report-columns-toggle no-print" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <span style={{ fontWeight: 'bold', width: '100%' }}>Colunas Visíveis:</span>
                  {Object.keys(reportColumns).map(col => (
                    <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={reportColumns[col]}
                        onChange={() => setReportColumns({ ...reportColumns, [col]: !reportColumns[col] })}
                      />
                      {col === 'date' ? 'Data' :
                        col === 'name' ? 'Servidor' :
                          col === 'role' ? 'Setor' :
                            col === 'entryTime' ? 'Entrada' :
                              col === 'lunchStart' ? 'Ida Almoço' :
                                col === 'lunchEnd' ? 'Volta Almoço' :
                                  col === 'exitTime' ? 'Saída' :
                                    col === 'status' ? 'Status' :
                                      'Total Horas'}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="printable-report">
              {reportType === 'dynamic' ? (
                <>
                  <div className="report-print-header only-print">
                    <div className="print-header-top">
                      {logo && <img src={logo} alt="Logo" className="print-logo" />}
                      <h1>Gestão de Frequência</h1>
                    </div>
                    <div className="print-header-details">
                      <p><strong>Relatório de Frequência Dinâmico</strong></p>
                      <p><strong>Servidor:</strong> {reportFilters.name || 'Todos'}</p>
                      <p><strong>Período:</strong> {reportFilters.startDate ? reportFilters.startDate.split('-').reverse().join('/') : 'Início'} até {reportFilters.endDate ? reportFilters.endDate.split('-').reverse().join('/') : 'Atual'}</p>
                    </div>
                  </div>

                  {filteredLogs.length === 0 ? (
                    <div className="empty-state">
                      <p className="no-data-msg">Nenhum registro encontrado para os filtros selecionados.</p>
                    </div>
                  ) : (
                    <div className="logs-table-container">
                      <table className="logs-table">
                        <thead>
                          <tr>
                            {reportColumns.date && <th>Data</th>}
                            {reportColumns.name && <th>Servidor</th>}
                            {reportColumns.role && <th>Setor</th>}
                            {reportColumns.entryTime && <th>Entrada</th>}
                            {reportColumns.lunchStart && <th>Ida Almoço</th>}
                            {reportColumns.lunchEnd && <th>Volta Almoço</th>}
                            {reportColumns.exitTime && <th>Saída</th>}
                            {reportColumns.status && <th>Status</th>}
                            {reportColumns.totalHours && <th>Total Horas</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map(log => (
                            <tr key={log.id}>
                              {reportColumns.date && <td>{log.date.split('-').reverse().join('/')}</td>}
                              {reportColumns.name && <td>{log.name}</td>}
                              {reportColumns.role && <td>{log.role}</td>}
                              {reportColumns.entryTime && <td>{log.entryTime}</td>}
                              {reportColumns.lunchStart && <td>{log.lunchStart || '--:--'}</td>}
                              {reportColumns.lunchEnd && <td>{log.lunchEnd || '--:--'}</td>}
                              {reportColumns.exitTime && <td>{log.exitTime || '--:--'}</td>}
                              {reportColumns.status && (
                                <td>
                                  <span className={`status-badge ${log.status}`}>
                                    {log.status === 'completed' ? 'Finalizado' : 'Em Andamento'}
                                  </span>
                                </td>
                              )}
                              {reportColumns.totalHours && (
                                <td>
                                  <button
                                    className="status-badge completed"
                                    style={{ border: 'none', cursor: 'pointer', background: 'none', color: 'inherit', padding: 0 }}
                                    onClick={() => showCalculationDetails(log)}
                                    title="Clique para ver o cálculo"
                                  >
                                    {calculateHours(log.entryTime, log.exitTime, log.lunchStart, log.lunchEnd)}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="print-footer only-print">
                        <div className="signature-line">
                          <div className="line"></div>
                          <p>Assinatura do Colaborador</p>
                        </div>
                        <div className="signature-line">
                          <div className="line"></div>
                          <p>Assinatura do Gestor</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="official-report-container">
                  <div className="official-header">
                    <div className="official-logos">
                      <div className="official-logo-box" style={{ width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo-uefs.jpeg" alt="Logo UEFS" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div className="official-logo-box" style={{ width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo-partiu.png" alt="Logo Partiu Estágio" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div className="official-logo-box" style={{ width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo-mais-futuro.jpg" alt="Logo Mais Futuro" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                      <div className="official-logo-box" style={{ width: '120px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo-seba.png" alt="Logo SAEB" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      </div>
                    </div>
                    <div className="official-title">FICHA DE CONTROLE DE FREQUÊNCIA</div>
                    <table className="official-info-table">
                      <tbody>
                        <tr>
                          <td><strong>Mês:</strong> {getMonthName(reportFilters.month)}</td>
                          <td><strong>Ano:</strong> {reportFilters.month.split('-')[0]}</td>
                        </tr>
                        <tr>
                          <td><strong>Nome:</strong> {reportFilters.name}</td>
                          <td><strong>Matrícula:</strong> {officialData.matricula}</td>
                        </tr>
                        <tr>
                          <td><strong>Unidade/Setor:</strong> {officialData.setor || filteredLogs[0]?.role || ''}</td>
                          <td><strong>Ramal:</strong> {officialData.ramal}</td>
                        </tr>
                        <tr>
                          <td><strong>Chefe Imediato:</strong> {officialData.chefe}</td>
                          <td><strong>Matrícula:</strong> {officialData.matriculaChefe}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <table className="official-data-table">
                    <thead>
                      <tr>
                        <th rowSpan="2">DIA</th>
                        <th colSpan="2">MANHÃ</th>
                        <th colSpan="2">TARDE</th>
                        <th colSpan="2">NOITE</th>
                        <th rowSpan="2">CARGA<br />HORÁRIA</th>
                        {showJustification && <th rowSpan="2">JUSTIFICATIVA</th>}
                      </tr>
                      <tr>
                        <th>ENTRADA</th>
                        <th>SAÍDA</th>
                        <th>ENTRADA</th>
                        <th>SAÍDA</th>
                        <th>ENTRADA</th>
                        <th>SAÍDA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renderOfficialDays()}
                    </tbody>
                  </table>

                  <div className="official-footer">
                    <div className="official-signature">
                      <div className="official-line"></div>
                      <p>Assinatura do Bolsista</p>
                    </div>
                    <div className="official-signature">
                      <div className="official-line"></div>
                      <p>Assinatura e carimbo do responsável pelo Estágio</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : view === 'users' && user.role === 'admin' ? (
          <section className="list-panel glass-panel">
            <div className="panel-header">
              <Users className="icon" size={24} />
              <h2>Gerenciar Usuários</h2>
            </div>
            
            <div className="logs-table-container" style={{ marginTop: '1.5rem' }}>
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Nível de Acesso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <select 
                          value={u.role} 
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === user.id}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: u.role === 'admin' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                            border: `1px solid ${u.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-secondary)'}`,
                            color: u.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-primary)',
                            outline: 'none'
                          }}
                        >
                          <option value="user">Usuário Padrão</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td>
                        <button 
                          className="delete-btn" 
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.id === user.id}
                          title={u.id === user.id ? "Você não pode excluir sua própria conta" : "Excluir usuário"}
                          style={{ opacity: u.id === user.id ? 0.3 : 1 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : view === 'settings' ? (
          <section className="form-panel glass-panel" style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="panel-header">
              <KeyRound className="icon" size={24} />
              <h2>Configurações da Conta</h2>
            </div>

            {user.role === 'admin' && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>Configurações Globais</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enableLunchBreak}
                    onChange={(e) => handleToggleLunchBreak(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span style={{ fontWeight: '500' }}>Exigir registro de intervalo de almoço</span>
                </label>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Se ativado, o fluxo de bater ponto dos usuários passará a exigir 4 etapas: Entrada, Ida ao Almoço, Volta do Almoço e Saída.
                </p>

                <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Configuração de E-mail (SMTP)</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Necessário para o recurso de "Esqueci minha senha".
                  </p>
                  <form onSubmit={handleSaveSmtp}>
                    <div className="form-group">
                      <label>Servidor SMTP (Host)</label>
                      <input type="text" className="form-input" value={smtpConfig.host} onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })} placeholder="ex: smtp.gmail.com" />
                    </div>
                    <div className="form-group">
                      <label>Porta (Port)</label>
                      <input type="number" className="form-input" value={smtpConfig.port} onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })} placeholder="ex: 587" />
                    </div>
                    <div className="form-group">
                      <label>Usuário (E-mail Remetente Autenticado)</label>
                      <input type="email" className="form-input" value={smtpConfig.user} onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })} placeholder="ex: no-reply@seusite.com" />
                    </div>
                    <div className="form-group">
                      <label>Senha do E-mail (App Password)</label>
                      <input type="password" className="form-input" value={smtpConfig.pass} onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })} placeholder="Preencha apenas para alterar a senha atual" />
                    </div>
                    <div className="form-group">
                      <label>E-mail de Remetente (From)</label>
                      <input type="email" className="form-input" value={smtpConfig.from} onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })} placeholder="ex: Sistema de Ponto <no-reply@seusite.com>" />
                    </div>
                    <div className="form-group">
                      <label>Proxy HTTP (Opcional - Para redes bloqueadas)</label>
                      <input type="text" className="form-input" value={smtpConfig.proxy} onChange={(e) => setSmtpConfig({ ...smtpConfig, proxy: e.target.value })} placeholder="ex: http://proxy.uefs.br:3128" />
                    </div>
                    <button type="submit" className="btn-submit" style={{ marginTop: '1rem', background: 'var(--accent-cyan)' }}>
                      Salvar Configurações SMTP
                    </button>
                  </form>
                </div>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Alterar Senha</h3>

              {passwordMsg && (
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {passwordMsg}
                </div>
              )}

              <div className="form-group">
                <label>Senha Atual</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Nova Senha</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn-submit">
                <CheckCircle2 size={20} />
                Atualizar Senha
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
