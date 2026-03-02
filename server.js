const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const DB_PATH = path.join(__dirname, 'data.sqlite');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// SQLite setup
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      price INTEGER NOT NULL,
      price_old INTEGER,
      status TEXT NOT NULL, -- 'lancamento' | 'venda'
      bedrooms INTEGER,
      bathrooms INTEGER,
      area INTEGER,
      image_url TEXT,
      advertiser_id INTEGER,
      boost_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (advertiser_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      advertiser_id INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected'
      receipt_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (advertiser_id) REFERENCES users(id)
    )
  `);

  // Seed demo data if needed
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users table', err);
      return;
    }
    if (row.count === 0) {
      const adminPass = bcrypt.hashSync('admin123', 10);
      const advertiserPass = bcrypt.hashSync('advertiser123', 10);

      db.run(
        `INSERT INTO users (role, name, email, password_hash) VALUES 
          ('admin', 'Admin', 'admin@example.com', ?),
          ('advertiser', 'Anunciante Demo', 'anunciante@example.com', ?)`,
        [adminPass, advertiserPass],
        function (err2) {
          if (err2) {
            console.error('Error seeding users', err2);
            return;
          }

          db.get(
            `SELECT id as advertiserId FROM users WHERE role = 'advertiser' LIMIT 1`,
            (err3, userRow) => {
              if (err3 || !userRow) {
                console.error('Error fetching advertiser for seed properties', err3);
                return;
              }

              const advertiserId = userRow.advertiserId;

              const seedStmt = db.prepare(`
                INSERT INTO properties 
                (title, neighborhood, city, state, price, price_old, status, bedrooms, bathrooms, area, image_url, advertiser_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              const props = [
                [
                  'Casa de Praia 4 quartos',
                  'Bertioga',
                  'Bertioga',
                  'SP',
                  420000,
                  null,
                  'venda',
                  4,
                  3,
                  250,
                  'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg',
                  advertiserId
                ],
                [
                  'Casa 3 quartos Centro',
                  'Centro',
                  'São Paulo',
                  'SP',
                  350000,
                  380000,
                  'lancamento',
                  3,
                  2,
                  180,
                  'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg',
                  advertiserId
                ],
                [
                  'Sala Comercial 45m² Berrini',
                  'Brooklin',
                  'São Paulo',
                  'SP',
                  320000,
                  null,
                  'venda',
                  1,
                  1,
                  45,
                  'https://images.pexels.com/photos/37347/office-office-at-work-job.jpg',
                  advertiserId
                ],
                [
                  'Terreno 500m² Condomínio Fechado',
                  'Alphaville',
                  'Barueri',
                  'SP',
                  250000,
                  null,
                  'venda',
                  0,
                  0,
                  500,
                  'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg',
                  advertiserId
                ],
                [
                  'Apartamento 2 quartos Jardim Paulista',
                  'Jardim Paulista',
                  'São Paulo',
                  'SP',
                  280000,
                  320000,
                  'lancamento',
                  2,
                  1,
                  65,
                  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg',
                  advertiserId
                ],
                [
                  'Apartamento Studio Vila Madalena',
                  'Vila Madalena',
                  'São Paulo',
                  'SP',
                  180000,
                  null,
                  'venda',
                  1,
                  1,
                  35,
                  'https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg',
                  advertiserId
                ]
              ];

              props.forEach(p => seedStmt.run(p));
              seedStmt.finalize();
              console.log('Seeded demo users and properties');
            }
          );
        }
      );
    }
  });
});

// Auth middleware
function authRequired(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token ausente' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido' });
    }
  };
}

// Multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `receipt_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({ storage });

// Routes
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  db.get(
    'SELECT * FROM users WHERE email = ? AND role = ?',
    [email, role],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Erro no servidor' });
      if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ token, user: { id: user.id, role: user.role, name: user.name, email: user.email } });
    }
  );
});

// Advertiser registration (public)
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Dados inválidos' });

  const password_hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (role, name, email, password_hash) VALUES (?, ?, ?, ?)',
    ['advertiser', name, email, password_hash],
    function (err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email já cadastrado' });
        return res.status(500).json({ error: 'Erro ao criar usuário' });
      }
      const userId = this.lastID;
      const token = jwt.sign({ id: userId, role: 'advertiser', name, email }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: userId, role: 'advertiser', name, email } });
    }
  );
});

// Admin: list and manage advertiser accounts
app.get('/api/users', authRequired(['admin']), (req, res) => {
  db.all('SELECT id, role, name, email, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao listar usuários' });
    res.json(rows);
  });
});

app.post('/api/users/:id/delete', authRequired(['admin']), (req, res) => {
  const id = Number(req.params.id);
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao remover usuário' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ success: true });
  });
});

app.get('/api/properties', (req, res) => {
  const { status, q, city } = req.query;
  let sql = `
    SELECT * FROM properties
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'todos') {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (q) {
    sql += ' AND (title LIKE ? OR neighborhood LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  if (city) {
    sql += ' AND city LIKE ?';
    params.push(`%${city}%`);
  }

  sql += `
    ORDER BY 
      CASE 
        WHEN boost_expires_at IS NOT NULL AND boost_expires_at > CURRENT_TIMESTAMP THEN 0
        ELSE 1
      END,
      created_at DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar imóveis' });
    res.json(rows);
  });
});

app.post('/api/properties', authRequired(['advertiser']), (req, res) => {
  const {
    title,
    neighborhood,
    city,
    state,
    price,
    price_old,
    status,
    bedrooms,
    bathrooms,
    area,
    image_url
  } = req.body;

  if (!title || !neighborhood || !city || !state || !price || !status) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  const sql = `
    INSERT INTO properties
    (title, neighborhood, city, state, price, price_old, status, bedrooms, bathrooms, area, image_url, advertiser_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    title,
    neighborhood,
    city,
    state,
    price,
    price_old || null,
    status,
    bedrooms || null,
    bathrooms || null,
    area || null,
    image_url || null,
    req.user.id
  ];

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao criar imóvel' });
    res.status(201).json({ id: this.lastID });
  });
});

app.post('/api/boosts', authRequired(['advertiser']), (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId) return res.status(400).json({ error: 'propertyId é obrigatório' });

  const sql = `
    INSERT INTO boosts (property_id, advertiser_id, status)
    VALUES (?, ?, 'pending')
  `;
  db.run(sql, [propertyId, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao solicitar destaque' });
    res.status(201).json({ id: this.lastID });
  });
});

app.post(
  '/api/boosts/:id/receipt',
  authRequired(['advertiser']),
  upload.single('receipt'),
  (req, res) => {
    const boostId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

    const relativePath = `/uploads/${req.file.filename}`;
    db.run(
      `UPDATE boosts SET receipt_path = ? WHERE id = ? AND advertiser_id = ?`,
      [relativePath, boostId, req.user.id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Erro ao salvar comprovante' });
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Boost não encontrado' });
        }
        res.json({ receipt_path: relativePath });
      }
    );
  }
);

app.get('/api/boosts', authRequired(['admin']), (req, res) => {
  db.all(
    `
    SELECT b.*, p.title, u.name as advertiser_name 
    FROM boosts b
    JOIN properties p ON p.id = b.property_id
    JOIN users u ON u.id = b.advertiser_id
    ORDER BY b.created_at DESC
  `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Erro ao listar boosts' });
      res.json(rows);
    }
  );
});

app.post('/api/boosts/:id/approve', authRequired(['admin']), (req, res) => {
  const id = req.params.id;

  db.serialize(() => {
    db.get('SELECT * FROM boosts WHERE id = ?', [id], (err, boost) => {
      if (err || !boost) {
        return res.status(404).json({ error: 'Boost não encontrado' });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.run(
        'UPDATE boosts SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['approved', id],
        err2 => {
          if (err2) return res.status(500).json({ error: 'Erro ao aprovar boost' });

          db.run(
            'UPDATE properties SET boost_expires_at = ? WHERE id = ?',
            [expiresAt, boost.property_id],
            err3 => {
              if (err3) return res.status(500).json({ error: 'Erro ao aplicar destaque' });
              res.json({ success: true, boost_expires_at: expiresAt });
            }
          );
        }
      );
    });
  });
});

app.post('/api/boosts/:id/reject', authRequired(['admin']), (req, res) => {
  const id = req.params.id;
  db.run(
    'UPDATE boosts SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['rejected', id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao rejeitar boost' });
      if (this.changes === 0) return res.status(404).json({ error: 'Boost não encontrado' });
      res.json({ success: true });
    }
  );
});

// Fallback for SPA routes (including /admin)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket chat
io.on('connection', socket => {
  console.log('Novo cliente conectado ao chat');

  socket.on('chat:message', msg => {
    const payload = {
      id: Date.now(),
      ...msg,
      timestamp: new Date().toISOString()
    };
    io.emit('chat:message', payload);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado do chat');
  });
});

server.listen(PORT, () => {
  console.log(`Anarquia Ecológica rodando em http://localhost:${PORT}`);
});
