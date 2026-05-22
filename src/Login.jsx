/* eslint-disable react/prop-types */
import { useState } from 'react';
import { Lock, Mail, UserPlus, LogIn as LogInIcon } from 'lucide-react';
import bcrypt from 'bcryptjs';

import './App.css';

const API_URL = '/api';

export default function Login({ onLogin }) {
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('resetToken');
  const [isResetting, setIsResetting] = useState(!!resetToken);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [funcao, setFuncao] = useState('');
  const [setor, setSetor] = useState('');
  const [ramal, setRamal] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  /**
   * Lida com o envio do formulário, tanto para login quanto para cadastro.
   * Utiliza um servidor local JSON-Server para gerenciar os dados.
   */
  
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isResetting) {
        if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
        if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao redefinir senha.');
        setSuccessMsg(data.message);
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else if (isForgotPassword) {
        if (!email.trim()) throw new Error('Por favor, informe seu e-mail.');
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await res.json();
        } else {
          throw new Error('Servidor retornou um erro inesperado (provavelmente erro de conexão com SMTP). Tente novamente.');
        }

        if (!res.ok) throw new Error(data.error || 'Falha ao enviar e-mail.');
        setSuccessMsg(data.message);
      } else if (isRegistering) {
        if (email !== confirmEmail) {
          throw new Error('Os e-mails não coincidem.');
        }
        if (password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem.');
        }

        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role: 'user', name, matricula, funcao, setor, ramal })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao criar conta.');
        
        localStorage.setItem('token', data.token);
        onLogin(data.user);

      } else {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'E-mail ou senha inválidos.');
        
        localStorage.setItem('token', data.token);
        onLogin(data.user);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <section className="form-panel glass-panel" style={{ maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <div className="panel-header" style={{ justifyContent: 'center', flexDirection: 'column' }}>
          <div className="logo-placeholder" style={{ marginBottom: '1rem' }}>
            <Lock size={48} />
          </div>
          <h2>{isForgotPassword ? 'Recuperar Senha' : isRegistering ? 'Criar Nova Conta' : 'Acesso ao Sistema'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            Controle de Frequência
          </p>
        </div>
        
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <div style={{position: 'relative'}}>
              <Mail className="icon" size={18} style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)'}} />
              <input 
                type="email" 
                id="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input" 
                placeholder="seu@email.com"
                style={{paddingLeft: '40px', width: '100%'}}
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="confirmEmail">Confirmar E-mail</label>
              <div style={{position: 'relative'}}>
                <Mail className="icon" size={18} style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)'}} />
                <input 
                  type="email" 
                  id="confirmEmail" 
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="form-input" 
                  placeholder="seu@email.com"
                  style={{paddingLeft: '40px', width: '100%'}}
                  required
                />
              </div>
            </div>
          )}

          {(isRegistering || isResetting) && (
            <>
              <div className="form-group">
                <label>Nome Completo</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input" required />
              </div>
              <div className="form-group">
                <label>Matrícula</label>
                <input type="text" value={matricula} onChange={(e) => setMatricula(e.target.value)} className="form-input" required />
              </div>
              <div className="form-group">
                <label>Função</label>
                <input type="text" value={funcao} onChange={(e) => setFuncao(e.target.value)} className="form-input" required />
              </div>
              <div className="form-group">
                <label>Setor/Unidade</label>
                <input type="text" value={setor} onChange={(e) => setSetor(e.target.value)} className="form-input" required />
              </div>
              <div className="form-group">
                <label>Ramal</label>
                <input type="text" value={ramal} onChange={(e) => setRamal(e.target.value)} className="form-input" required />
              </div>
            </>
          )}

          {(!isForgotPassword || isResetting) && (
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div style={{position: 'relative'}}>
                <Lock className="icon" size={18} style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)'}} />
                <input 
                  type="password" 
                  id="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input" 
                  placeholder="******"
                  style={{paddingLeft: '40px', width: '100%'}}
                  required
                />
              </div>
            </div>
          )}

          {(isRegistering || isResetting) && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Senha</label>
              <div style={{position: 'relative'}}>
                <Lock className="icon" size={18} style={{position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)'}} />
                <input 
                  type="password" 
                  id="confirmPassword" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input" 
                  placeholder="******"
                  style={{paddingLeft: '40px', width: '100%'}}
                  required
                />
              </div>
            </div>
          )}

                    <button type="submit" className="btn-submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {isResetting ? <Lock size={20} /> : isForgotPassword ? <Mail size={20} /> : isRegistering ? <UserPlus size={20} /> : <LogInIcon size={20} />}
            {loading ? 'Aguarde...' : isResetting ? 'Redefinir Senha' : isForgotPassword ? 'Enviar Instruções' : isRegistering ? 'Cadastrar' : 'Entrar com Senha'}
          </button>
          

        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(!isForgotPassword || isResetting) && (
            <button 
              type="button" 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setSuccessMsg('');
              }}
              style={{ background: 'none', color: 'var(--accent-cyan)', fontSize: '0.875rem', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
            </button>
          )}
          {!isResetting && (
            <button 
              type="button" 
              onClick={() => {
              setIsForgotPassword(!isForgotPassword);
              setIsRegistering(false);
              setError('');
              setSuccessMsg('');
            }}
            style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'underline' }}
          >
            {isForgotPassword ? 'Voltar para o Login' : 'Esqueci minha senha'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
