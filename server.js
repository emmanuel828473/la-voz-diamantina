const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'respuestas.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const init = { participants: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { participants: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const QUESTIONS = [
  {
    id: 1,
    order_num: 1,
    prompt: "¿Cuántas secciones tiene el periódico escolar?",
    type: "multiple",
    options: [
      { id: 101, text: "Cuatro secciones.", isCorrect: false },
      { id: 102, text: "Cinco secciones.", isCorrect: false },
      { id: 103, text: "Seis secciones.", isCorrect: true },
      { id: 104, text: "Ocho secciones.", isCorrect: false }
    ]
  },
  {
    id: 2,
    order_num: 2,
    prompt: "¿Quiénes integran el comité de redacción y diseño?",
    type: "multiple",
    options: [
      { id: 201, text: "Solo los docentes de Humanidades.", isCorrect: false },
      { id: 202, text: "Lina, la del PTA, el área de Humanidades e Inglés y los líderes estudiantiles.", isCorrect: true },
      { id: 203, text: "El rector y los coordinadores.", isCorrect: false },
      { id: 204, text: "Únicamente los personeros estudiantiles.", isCorrect: false }
    ]
  },
  {
    id: 3,
    order_num: 3,
    prompt: "¿En qué año fue creado el periódico escolar?",
    type: "multiple",
    options: [
      { id: 301, text: "2022", isCorrect: false },
      { id: 302, text: "2023", isCorrect: false },
      { id: 303, text: "2024", isCorrect: true },
      { id: 304, text: "2025", isCorrect: false }
    ]
  },
  { id: 4, order_num: 4, prompt: "¿Qué sección recuerdas del periódico?", type: "open" },
  { id: 5, order_num: 5, prompt: "¿Cuál es el nombre del periódico escolar?", type: "open" },
  { id: 6, order_num: 6, prompt: "¿Por qué un periódico escolar puede ser una herramienta pedagógica?", type: "open" },
  { id: 7, order_num: 7, prompt: "¿Qué habilidades pueden fortalecer los estudiantes al participar en el periódico?", type: "open" },
  { id: 8, order_num: 8, prompt: "¿Cómo puede el periódico favorecer la lectura y la escritura?", type: "open" }
];

app.get('/api/questions', (req, res) => {
  const sanitized = QUESTIONS.map(q => ({
    id: q.id,
    order_num: q.order_num,
    prompt: q.prompt,
    type: q.type,
    options: q.type === 'multiple' ? q.options.map(o => ({ id: o.id, text: o.text })) : []
  }));
  res.json(sanitized);
});

app.post('/api/responses', (req, res) => {
  const { answers } = req.body;
  if (!answers || !answers.length) return res.status(400).json({ error: "Faltan respuestas." });

  const db = readData();
  const nextNum = db.participants.length + 1;
  const anonId = `Persona anónima #${String(nextNum).padStart(3, '0')}`;

  const studentResponses = [];

  for (const ans of answers) {
    const q = QUESTIONS.find(item => item.id === ans.questionId);
    if (!q) continue;

    if (q.type === 'multiple') {
      const opt = q.options.find(o => o.id === ans.selectedOptionId);
      studentResponses.push({
        questionId: q.id,
        order_num: q.order_num,
        prompt: q.prompt,
        selectedOptionId: ans.selectedOptionId,
        selectedOptionText: opt ? opt.text : '',
        isCorrect: opt ? opt.isCorrect : false
      });
    } else {
      const text = String(ans.openText || '').trim();
      studentResponses.push({
        questionId: q.id,
        order_num: q.order_num,
        prompt: q.prompt,
        openText: text
      });
    }
  }

  db.participants.push({
    anonymous_id: anonId,
    responses: studentResponses
  });

  saveData(db);
  res.json({ success: true, anonymousId: anonId });
});

app.get('/api/public-feed', (req, res) => {
  const db = readData();
  const totalParticipants = db.participants.length;

  const multipleQ = QUESTIONS.filter(q => q.type === 'multiple');
  const stats = multipleQ.map(q => {
    let totalAns = 0;
    let correctAns = 0;
    const voteMap = {};
    q.options.forEach(o => { voteMap[o.id] = 0; });

    db.participants.forEach(p => {
      const r = p.responses.find(item => item.questionId === q.id);
      if (r && r.selectedOptionId) {
        totalAns++;
        if (r.isCorrect) correctAns++;
        if (voteMap[r.selectedOptionId] !== undefined) {
          voteMap[r.selectedOptionId]++;
        }
      }
    });

    const options = q.options.map(o => ({
      text: o.text,
      isCorrect: o.isCorrect,
      votes: voteMap[o.id] || 0,
      percentage: totalAns > 0 ? Math.round(((voteMap[o.id] || 0) / totalAns) * 100) : 0
    }));

    return {
      orderNum: q.order_num,
      prompt: q.prompt,
      totalAns,
      correctAns,
      percentageCorrect: totalAns > 0 ? Math.round((correctAns / totalAns) * 100) : 0,
      options
    };
  });

  const openResponses = [];
  db.participants.slice().reverse().forEach(p => {
    p.responses.forEach(r => {
      if (r.openText && r.openText.trim().length > 0) {
        openResponses.push({
          order_num: r.order_num,
          prompt: r.prompt,
          anonymous_id: p.anonymous_id,
          open_text: r.openText
        });
      }
    });
  });

  res.json({ totalParticipants, stats, openResponses });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
