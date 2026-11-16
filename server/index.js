const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
const allowedOrigins = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
    : null;
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: '10mb' })); // Aumentado para escalas grandes
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

// Autenticação opcional por chave de API (recomendado em produção)
const API_SECRET_KEY = process.env.API_SECRET_KEY;
function requireApiKey(req, res, next) {
    if (!API_SECRET_KEY) return next();
    const provided = req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!provided || provided !== API_SECRET_KEY) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    return next();
}

function validateKeyParam(rawKey) {
    return typeof rawKey === 'string' && /^[a-zA-Z0-9_.-]{1,128}$/.test(rawKey);
}

// Configuração do MongoDB (Conexão Grátis Atlas)
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ Conectado ao MongoDB Atlas'))
        .catch(err => console.error('❌ Erro de conexão MongoDB:', err));
} else {
    console.warn('⚠️ MONGODB_URI não configurada. Usando armazenamento em memória (VÁLIDO APENAS PARA TESTES).');
}

// Modelo de Dados Simples (Chave-Valor)
const DataSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

const DataModel = mongoose.model('ScaleData', DataSchema);

// Mock storage for local test
let memoryDB = {};

// 🔍 GET: Buscar dados
app.get('/', requireApiKey, async (req, res) => {
    const key = req.query.key;
    if (!validateKeyParam(key)) return res.status(400).send('Parâmetro key inválido ou ausente');

    try {
        if (mongoose.connection.readyState === 1) {
            const doc = await DataModel.findOne({ key: String(key) });
            return res.send(doc ? doc.value : []);
        }
        // Fallback p/ memória se o banco falhar
        return res.send(Object.prototype.hasOwnProperty.call(memoryDB, key) ? memoryDB[key] : []);
    } catch (err) {
        console.error('Erro no GET:', err);
        res.status(500).send('Erro interno no servidor');
    }
});

// 💾 POST: Salvar dados
app.post('/', requireApiKey, async (req, res) => {
    const key = req.query.key;
    if (!validateKeyParam(key)) return res.status(400).send('Parâmetro key inválido ou ausente');

    let bodyData = req.body;
    
    // Converte de texto para JSON se necessário
    if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    try {
        if (mongoose.connection.readyState === 1) {
            await DataModel.findOneAndUpdate(
                { key: String(key) },
                { value: bodyData, updatedAt: Date.now() },
                { upsert: true, new: true }
            );
        }
        
        // Mantém em memória também como cache ultra-rápido
        memoryDB[key] = bodyData;
        
        res.status(200).send('OK - Salvo');
    } catch (err) {
        console.error('Erro no POST:', err);
        res.status(500).send('Erro ao salvar no banco');
    }
});

// Health check para o Render
app.get('/health', (req, res) => res.send('RH Escala API Online 🚀'));

app.listen(PORT, () => {
    console.log(`🌍 Servidor rodando na porta ${PORT}`);
});
