
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

