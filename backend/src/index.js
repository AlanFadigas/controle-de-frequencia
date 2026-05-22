
// Add BigInt support for JSON.stringify
BigInt.prototype.toJSON = function() { return this.toString() };
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const rpName = 'Estagiario Auth';

const getRpIdAndOrigin = (req) => {
  const origin = req.get('origin') || 'http://localhost';
  let rpID = 'localhost';
  try {
    const url = new URL(origin);
    rpID = url.hostname;
  } catch(e){}
  return { rpID, origin };
};

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
    req.user = user; // { userId, role }
    next();
  });
};

// Middleware para verificar Admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
  }
  next();
};

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, role, name, matricula, funcao, setor, ramal } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || 'user',
        name,
        matricula,
        funcao,
        setor,
        ramal
      }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    // Removendo a senha antes de retornar
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password) || password === user.password;
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});



// ==========================================
// ROTAS DE RECUPERAÇÃO DE SENHA
// ==========================================

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'E-mail não encontrado.' });

    const settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    if (!settings || !settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      return res.status(500).json({ error: 'O servidor de e-mail não foi configurado pelo administrador.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires }
    });

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpPort === 465,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
      proxy: settings.smtpProxy || undefined,
    });

    const origin = req.get('origin') || 'http://localhost';
    const resetLink = `${origin}/?resetToken=${resetToken}`;

    await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser,
      to: user.email,
      subject: 'Recuperação de Senha - Sistema de Ponto',
      html: `
        <h3>Olá, ${user.name || user.email}</h3>
        <p>Você solicitou a redefinição da sua senha.</p>
        <p>Clique no link abaixo para criar uma nova senha. Este link expira em 1 hora.</p>
        <a href="${resetLink}" style="padding: 10px 20px; background: #8b5cf6; color: #fff; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
        <p><br>Se você não solicitou isso, apenas ignore este e-mail.</p>
      `
    });

    res.json({ success: true, message: 'E-mail de recuperação enviado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao enviar o e-mail de recuperação.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() }
      }
    });

    if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    });

    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
});


// ==========================================
// ROTAS DE USUÁRIOS
// ==========================================

app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, matricula: true, funcao: true, setor: true, ramal: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

app.patch('/api/users/:id/role', authenticateToken, isAdmin, async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role }
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar permissão' });
  }
});

app.patch('/api/users/:id/password', authenticateToken, async (req, res) => {
  if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    const isMatch = bcrypt.compareSync(oldPassword, user.password) || oldPassword === user.password;
    if (!isMatch) return res.status(400).json({ error: 'Senha atual incorreta' });
    
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// ==========================================
// ROTAS DE CONFIGURAÇÕES
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    let settings = await prisma.setting.findUnique({ where: { id: 'global' } });
    if (!settings) {
      settings = await prisma.setting.create({ data: { id: 'global' } });
    }
    // Removemos a senha da resposta por segurança
    const { smtpPass, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

app.put('/api/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const data = req.body;
    const settings = await prisma.setting.upsert({
      where: { id: 'global' },
      update: data,
      create: { id: 'global', ...data }
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações' });
  }
});

// ==========================================
// ROTAS DE LOGS (PONTO)
// ==========================================

app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;
    const where = {};
    if (userId) {
      if (req.user.role !== 'admin' && req.user.userId !== userId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      where.userId = userId;
    } else if (req.user.role !== 'admin') {
      where.userId = req.user.userId;
    }
    
    const logs = await prisma.log.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

app.post('/api/logs', authenticateToken, async (req, res) => {
  try {
    const logData = req.body;
    
    // Check if the user is writing to their own account or is an admin
    if (req.user.role !== 'admin' && logData.userId !== req.user.userId) {
      logData.userId = req.user.userId; 
    }
    
    const newLog = await prisma.log.create({
      data: logData
    });
    res.json(newLog);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Erro ao criar log' });
  }
});

app.put('/api/logs/:id', authenticateToken, async (req, res) => {
  try {
    const log = await prisma.log.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ error: 'Log não encontrado' });
    
    if (req.user.role !== 'admin' && log.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const updatedLog = await prisma.log.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(updatedLog);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar log' });
  }
});

app.delete('/api/logs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await prisma.log.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir log' });
  }
});


const PORT = process.env.PORT || 3333;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando na rede local na porta ${PORT}`);
});
