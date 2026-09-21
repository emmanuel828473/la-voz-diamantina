document.addEventListener('DOMContentLoaded', () => {
  const tabQuizBtn = document.getElementById('tabQuizBtn');
  const tabFeedBtn = document.getElementById('tabFeedBtn');
  const quizSection = document.getElementById('quizSection');
  const feedSection = document.getElementById('feedSection');

  const btnStart = document.getElementById('btnStart');
  const welcomeBox = document.getElementById('welcomeBox');
  const progressBox = document.getElementById('progressBox');
  const quizForm = document.getElementById('quizForm');
  const multipleContainer = document.getElementById('multipleContainer');
  const openContainer = document.getElementById('openContainer');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const progressFill = document.getElementById('progressFill');
  const errorAlert = document.getElementById('errorAlert');
  const successBox = document.getElementById('successBox');
  const assignedAnonBadge = document.getElementById('assignedAnonBadge');
  const btnGoToFeed = document.getElementById('btnGoToFeed');

  const totalCountDisplay = document.getElementById('totalCountDisplay');
  const statsGrid = document.getElementById('statsGrid');
  const feedFilter = document.getElementById('feedFilter');
  const feedList = document.getElementById('feedList');

  let questionsData = [];
  let feedDataCache = [];

  tabQuizBtn.addEventListener('click', () => {
    tabQuizBtn.classList.add('active');
    tabFeedBtn.classList.remove('active');
    quizSection.style.display = 'block';
    feedSection.style.display = 'none';
  });

  tabFeedBtn.addEventListener('click', () => {
    tabFeedBtn.classList.add('active');
    tabQuizBtn.classList.remove('active');
    quizSection.style.display = 'none';
    feedSection.style.display = 'block';
    loadPublicFeed();
  });

  btnGoToFeed.addEventListener('click', () => {
    tabFeedBtn.click();
  });

  btnStart.addEventListener('click', () => {
    welcomeBox.style.display = 'none';
    progressBox.style.display = 'block';
    quizForm.style.display = 'block';
    loadQuestions();
  });

  async function loadQuestions() {
    try {
      const res = await fetch('/api/questions');
      questionsData = await res.json();

      multipleContainer.innerHTML = '';
      openContainer.innerHTML = '';

      questionsData.forEach(q => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `<h4>${q.order_num}. ${q.prompt}</h4>`;

        if (q.type === 'multiple') {
          q.options.forEach(opt => {
            const label = document.createElement('label');
            label.className = 'option-item';
            label.innerHTML = `
              <input type="radio" name="q_${q.id}" value="${opt.id}">
              <span>${opt.text}</span>
            `;
            label.querySelector('input').addEventListener('change', updateProgress);
            card.appendChild(label);
          });
          multipleContainer.appendChild(card);
        } else {
          const textarea = document.createElement('textarea');
          textarea.className = 'open-input';
          textarea.name = `q_${q.id}`;
          textarea.rows = 3;
          textarea.placeholder = 'Escribe aquí tu opinión sincera...';
          textarea.addEventListener('input', updateProgress);
          card.appendChild(textarea);
          openContainer.appendChild(card);
        }
      });
      updateProgress();
    } catch (e) {
      errorAlert.textContent = 'Error al cargar las preguntas.';
      errorAlert.style.display = 'block';
    }
  }

  function updateProgress() {
    let answered = 0;
    questionsData.forEach(q => {
      if (q.type === 'multiple') {
        if (document.querySelector(`input[name="q_${q.id}"]:checked`)) answered++;
      } else {
        const txt = document.querySelector(`textarea[name="q_${q.id}"]`);
        if (txt && txt.value.trim().length > 0) answered++;
      }
    });

    const total = questionsData.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    progressText.textContent = `Pregunta ${answered} de ${total} respondidas`;
    progressPercent.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
  }

  quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';

    const payload = [];
    for (const q of questionsData) {
      if (q.type === 'multiple') {
        const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (!sel) {
          showError(`Por favor responde la pregunta ${q.order_num} antes de enviar.`);
          return;
        }
        payload.push({ questionId: q.id, type: 'multiple', selectedOptionId: parseInt(sel.value) });
      } else {
        const val = document.querySelector(`textarea[name="q_${q.id}"]`).value.trim();
        if (!val) {
          showError(`Por favor responde la pregunta ${q.order_num} antes de enviar.`);
          return;
        }
        payload.push({ questionId: q.id, type: 'open', openText: val });
      }
    }

    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload })
      });
      const data = await res.json();

      if (data.success) {
        quizForm.style.display = 'none';
        progressBox.style.display = 'none';
        assignedAnonBadge.textContent = data.anonymousId;
        successBox.style.display = 'block';
      } else {
        showError(data.error || 'Error al guardar.');
      }
    } catch (err) {
      showError('No se pudo conectar con el servidor.');
    }
  });

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.style.display = 'block';
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function loadPublicFeed() {
    try {
      const res = await fetch('/api/public-feed');
      const data = await res.json();

      totalCountDisplay.textContent = data.totalParticipants;
      renderStats(data.stats);
      feedDataCache = data.openResponses;
      renderFeedList(feedDataCache);
    } catch (e) {
      feedList.innerHTML = '<p>Error al cargar las respuestas.</p>';
    }
  }

  function renderStats(stats) {
    statsGrid.innerHTML = '';
    stats.forEach(st => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      let optionsHtml = '';

      st.options.forEach(opt => {
        optionsHtml += `
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-top:8px;">
            <span>${opt.text} ${opt.isCorrect ? '✓' : ''}</span>
            <span><strong>${opt.percentage}%</strong> (${opt.votes})</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${opt.isCorrect ? 'correct' : ''}" style="width: ${opt.percentage}%;"></div>
          </div>
        `;
      });

      card.innerHTML = `
        <h4 style="font-size:1.05rem;">${st.orderNum}. ${st.prompt}</h4>
        <div style="font-size:0.85rem; color:#006644; font-weight:700; margin:4px 0 10px;">
          Porcentaje de acierto general: ${st.percentageCorrect}%
        </div>
        ${optionsHtml}
      `;
      statsGrid.appendChild(card);
    });
  }

  function renderFeedList(items) {
    feedList.innerHTML = '';
    if (!items || items.length === 0) {
      feedList.innerHTML = '<p style="text-align:center; color:#888; padding:30px;">Aún no hay respuestas registradas. ¡Sé el primero en responder!</p>';
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'feed-item';
      el.innerHTML = `
        <div class="feed-anon-id">${item.anonymous_id}</div>
        <div class="feed-prompt">${item.order_num}. ${item.prompt}</div>
        <div class="feed-text">“${item.open_text}”</div>
      `;
      feedList.appendChild(el);
    });
  }

  feedFilter.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
      renderFeedList(feedDataCache);
    } else {
      const filtered = feedDataCache.filter(item => String(item.order_num) === val);
      renderFeedList(filtered);
    }
  });
});
