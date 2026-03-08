const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentado para escalas grandes
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

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
app.get('/', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).send('Falta o parâmetro key');

    try {
        if (mongoose.connection.readyState === 1) {
            const doc = await DataModel.findOne({ key });
            return res.send(doc ? doc.value : []);
        }
        // Fallback p/ memória se o banco falhar
        return res.send(memoryDB[key] || []);
    } catch (err) {
        console.error('Erro no GET:', err);
        res.status(500).send('Erro interno no servidor');
    }
});

// 💾 POST: Salvar dados
app.post('/', async (req, res) => {
    const { key } = req.query;
    if (!key) return res.status(400).send('Falta o parâmetro key');

    let bodyData = req.body;
    
    // Converte de texto para JSON se necessário
    if (typeof bodyData === 'string') {
        try { bodyData = JSON.parse(bodyData); } catch (e) {}
    }

    try {
        if (mongoose.connection.readyState === 1) {
            await DataModel.findOneAndUpdate(
                { key },
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
