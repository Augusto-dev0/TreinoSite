/* ═══════════════════════════════════════════════════════════════════════════
   MEUS TREINOS — script.js  (v4)
   Features: ícones Phosphor, timer hh:mm:ss, edição de histórico,
             100% responsivo, PWA offline
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── PWA: Service Worker ─────────────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const DAYS_SHORT   = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const DAYS_FULL    = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const WEEKDAY      = (new Date().getDay() + 6) % 7;
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const CATALOG_CATEGORIES = ['Academia','Casa','Calistenia','Esportes','Funcional','Mobilidade'];
const EQUIPMENT_OPTIONS = ['Todos','Nenhum','Barra','Halteres','Maquina','Cabo','Elastico','Kettlebell','Banco','Bola','Cardio','Faixa/TRX','Anilha','Caixa','Medicine ball'];
const GROUP_META = {
  Peito:    { icon:'💪', color:'#f97373' },
  Costas:   { icon:'🪽', color:'#60a5fa' },
  Pernas:   { icon:'🦵', color:'#c8f060' },
  Ombros:   { icon:'🏋️', color:'#facc15' },
  Biceps:   { icon:'💪', color:'#f472b6' },
  Triceps:  { icon:'🦾', color:'#c084fc' },
  Abdomen:  { icon:'🔥', color:'#fb923c' },
  Gluteos:  { icon:'⚡', color:'#a78bfa' },
  Cardio:   { icon:'❤️', color:'#ef4444' },
  Mobilidade: { icon:'🧘', color:'#3ecfb0' },
  Corpo:    { icon:'⚙️', color:'#38bdf8' },
};

/* ── Storage keys ────────────────────────────────────────────────────────── */
const K_LIB      = 'mt-library-v1';
const K_WORKOUTS = 'mt-workouts-v1';
const K_HISTORY  = 'mt-history-v1';
const K_CHECKLIST_DISMISSED = 'mt-checklist-dismissed';

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || (key===K_WORKOUTS?{}:[]); }
  catch { return key===K_WORKOUTS?{}:[]; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ── App State ───────────────────────────────────────────────────────────── */
let library  = load(K_LIB);
let workouts = load(K_WORKOUTS);
let history  = load(K_HISTORY);

/* Migração única v4→v5: a v4 pré-populava a biblioteca automaticamente.
   Roda apenas uma vez (flag mt-migrated-v5) e nunca mais toca nos dados. */
(function migrateV4toV5() {
  const K_MIG = 'mt-migrated-v5';
  if (localStorage.getItem(K_MIG)) return;
  localStorage.setItem(K_MIG, '1');
  const allAuto = library.length > 0 && library.every(e => e.catalogId && !e._userImported);
  if (allAuto) { library = []; save(K_LIB, library); }
})();
let selDay   = WEEKDAY;
let libFilter = 'Todos';
let libraryMode = 'my';
const exerciseCatalog = buildExerciseCatalog();

/* Workout builder */
let wkDay=null, wkEditIdx=null, wkSel=[], wkFilter='Todos';
/* Exercise editor */
let exEditId = null;
/* Drag & drop */
let dragSrcIdx = null;

/* Timer (rest) */
let tTotal=60, tRemain=60, tRunning=false, tInterval=null;
const PRESETS=[30,60,90,120];

/* Active workout */
let activeWk    = null;
let activeCur   = 0;
let activeStart = null;
let elapsedInterval = null;
let restInterval = null;
let restRemain   = 0;

/* History edit */
let histEditId = null;

/* Library selection */
let libSelectMode = false;
let libSelected   = new Set();
let catalogEditId = null;

/* Catalog selection mode */
let catalogSelectMode = false;
let catalogSelected   = new Set();

/* ═══════════════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════════════ */
(function init() {
  const dn = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  document.getElementById('today-label').textContent = dn[new Date().getDay()];

  document.querySelectorAll('.tab, .bnav-btn').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab))
  );

  renderStats();
  renderChecklist();
  renderDayStrip();
  renderDayContent();
  renderHistory();
  renderLibrary();
  renderTimerPresets();
  updateTimerUI();
})();

/* ═══════════════════════════════════════════════════════════════════════════
   ELAPSED TIME FORMATTER
   Formata segundos em mm:ss ou h:mm:ss quando >= 3600s
   ═══════════════════════════════════════════════════════════════════════════ */
function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/* Formata duração em minutos para exibição legível */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function slugify(txt) {
  return txt.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'');
}

function buildExerciseCatalog() {
  const groups = [
    { muscle:'Peito', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Supino reto','Supino inclinado','Supino declinado','Crucifixo','Fly inclinado','Crossover','Pullover','Press convergente','Peck deck','Squeeze press','Flexao no smith','Supino fechado'] },
    { muscle:'Peito', category:'Casa', equipment:['Nenhum','Elastico','Halteres','Banco'], base:['Flexao de bracos','Flexao inclinada','Flexao declinada','Flexao diamante','Flexao aberta','Flexao arqueiro','Crucifixo no chao','Press no chao','Pullover no chao','Isometria de flexao'] },
    { muscle:'Peito', category:'Calistenia', equipment:['Nenhum','Barra','Faixa/TRX'], base:['Flexao hindu','Flexao explosiva','Flexao pseudo planche','Flexao com palmada','Flexao pike','Mergulho em paralelas','Mergulho entre bancos','Flexao unilateral assistida','Flexao typewriter','Planche lean'] },
    { muscle:'Costas', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Puxada frente','Puxada supinada','Puxada neutra','Remada curvada','Remada baixa','Remada cavalinho','Remada unilateral','Pulldown reto','Remada articulada','Remada alta','Levantamento terra','Encolhimento escapular'] },
    { muscle:'Costas', category:'Casa', equipment:['Elastico','Halteres','Faixa/TRX','Nenhum'], base:['Remada com elastico','Remada curvada caseira','Remada unilateral caseira','Superman','Superman alternado','Good morning','Pulldown com elastico','Remada invertida na mesa','Extensao lombar no chao','Y raise'] },
    { muscle:'Costas', category:'Calistenia', equipment:['Barra','Faixa/TRX','Nenhum'], base:['Barra fixa pronada','Barra fixa supinada','Barra fixa neutra','Chin up','Australian pull up','Remada invertida','Scapular pull up','Muscle up assistido','Archer pull up','Front lever tuck','Skin the cat','Back extension'] },
    { muscle:'Pernas', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Anilha'], base:['Agachamento livre','Agachamento frontal','Leg press','Cadeira extensora','Mesa flexora','Stiff','Levantamento terra romeno','Afundo','Passada','Hack squat','Panturrilha em pe','Panturrilha sentado','Adutora','Abdutora','Agachamento sumo'] },
    { muscle:'Pernas', category:'Casa', equipment:['Nenhum','Halteres','Elastico','Banco','Caixa'], base:['Agachamento livre','Agachamento sumo','Agachamento bulgaro','Afundo parado','Avanco alternado','Passada reversa','Step up','Ponte de gluteo','Elevação de panturrilha','Wall sit','Agachamento isometrico','Good morning'] },
    { muscle:'Pernas', category:'Calistenia', equipment:['Nenhum','Caixa','Banco'], base:['Pistol squat assistido','Pistol squat','Shrimp squat','Sissy squat','Nordic curl assistido','Agachamento com salto','Salto na caixa','Cossack squat','Skater squat','Panturrilha unilateral','Lunge jump','Step down'] },
    { muscle:'Gluteos', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Hip thrust','Glute bridge','Coice no cabo','Abducao no cabo','Abdutora','Levantamento sumo','Stiff unilateral','Pull through','Passada longa','Agachamento sumo','Kickback maquina','Extensao de quadril'] },
    { muscle:'Gluteos', category:'Casa', equipment:['Nenhum','Elastico','Halteres','Banco'], base:['Ponte de gluteo','Ponte unilateral','Abducao lateral','Clamshell','Coice no chao','Fire hydrant','Elevação pelvica','Frog pump','Step up alto','Afundo longo','Good morning unilateral','Caminhada lateral'] },
    { muscle:'Ombros', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Desenvolvimento militar','Desenvolvimento sentado','Elevação lateral','Elevação frontal','Crucifixo inverso','Remada alta','Face pull','Arnold press','Encolhimento','Rotacao externa','Rotacao interna','Desenvolvimento maquina'] },
    { muscle:'Ombros', category:'Casa', equipment:['Halteres','Elastico','Nenhum'], base:['Elevação lateral caseira','Elevação frontal caseira','Pike push up','Handstand hold','Wall walk','Y raise','T raise','Rotacao externa com elastico','Desenvolvimento com elastico','Prancha toque ombro'] },
    { muscle:'Ombros', category:'Calistenia', equipment:['Nenhum','Barra','Faixa/TRX'], base:['Pike push up','Handstand push up assistido','Handstand hold','Wall walk','Pseudo planche push up','Scapular push up','Dips inclinados','Planche lean','Prancha shoulder tap','Bear crawl'] },
    { muscle:'Biceps', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Rosca direta','Rosca alternada','Rosca martelo','Rosca scott','Rosca concentrada','Rosca inversa','Rosca punho','Rosca 21','Rosca inclinada','Rosca Zottman','Rosca unilateral no cabo','Rosca bayesian'] },
    { muscle:'Biceps', category:'Casa', equipment:['Halteres','Elastico','Nenhum'], base:['Rosca com elastico','Rosca martelo caseira','Rosca concentrada caseira','Rosca isometrica','Rosca com garrafinha','Rosca alternada sentado'] },
    { muscle:'Biceps', category:'Calistenia', equipment:['Nenhum','Barra','Faixa/TRX'], base:['Chin up supinado','Barra supinada','Bodyweight curl','Commando pull up','Negative chin up','Australian pull up supinado','Archer chin up'] },
    { muscle:'Triceps', category:'Academia', equipment:['Barra','Halteres','Maquina','Cabo','Elastico'], base:['Triceps testa','Triceps corda','Triceps frances','Triceps coice','Triceps barra reta','Triceps unilateral','Paralela maquina','Mergulho banco','Extensao punho','Kickback','Triceps supinado no cabo','Triceps overhead'] },
    { muscle:'Triceps', category:'Casa', equipment:['Halteres','Elastico','Nenhum','Banco'], base:['Triceps banco','Triceps frances caseiro','Triceps coice caseiro','Flexao fechada','Flexao diamante','Prancha sobe e desce','Mergulho entre cadeiras','Triceps com elastico'] },
    { muscle:'Triceps', category:'Calistenia', equipment:['Nenhum','Barra','Faixa/TRX'], base:['Dips','Flexao diamante','Flexao fechada','Triceps extension TRX','Bench dips','Dips assistido','Pseudo planche dip','Diamond push up explosivo'] },
    { muscle:'Abdomen', category:'Academia', equipment:['Cabo','Maquina','Banco','Bola','Anilha'], base:['Abdominal maquina','Crunch no cabo','Elevação de pernas','Abdominal infra','Prancha com carga','Russian twist','Abdominal declinado','Woodchopper','Pallof press','Hanging knee raise','Hanging leg raise','Ab wheel'] },
    { muscle:'Abdomen', category:'Casa', equipment:['Nenhum','Bola','Elastico','Anilha'], base:['Prancha','Prancha lateral','Crunch','Bicicleta abdominal','Abdominal infra','Elevação de pernas','Dead bug','Hollow hold','Mountain climber','Canivete','Russian twist','Bird dog'] },
    { muscle:'Abdomen', category:'Calistenia', equipment:['Nenhum','Barra'], base:['L-sit tuck','L-sit','Dragon flag assistido','Toes to bar','Hanging knee raise','Hollow rock','V-up','Plank walk','Windshield wiper','Front lever tuck raise'] },
    { muscle:'Cardio', category:'Casa', equipment:['Nenhum','Cardio','Caixa'], base:['Polichinelo','Burpee','Corrida parada','Skipping alto','Mountain climber rapido','Agachamento com salto','Lunge jump','High knees','Jumping jack','Shadow boxing','Step touch','Corrida lateral'] },
    { muscle:'Cardio', category:'Academia', equipment:['Cardio'], base:['Esteira caminhada','Esteira corrida','Bike ergometrica','Eliptico','Remo indoor','Escada ergometrica','Air bike','Ski erg','Bike spinning','Trote inclinado'] },
    { muscle:'Corpo', category:'Funcional', equipment:['Kettlebell','Medicine ball','Caixa','Corda','Halteres','Nenhum'], base:['Kettlebell swing','Turkish get up','Clean com kettlebell','Snatch com kettlebell','Arremesso medicine ball','Slam ball','Farmer walk','Bear crawl','Caminhada do caranguejo','Thruster','Devil press','Renegade row','Burpee box jump','Corda naval'] },
    { muscle:'Corpo', category:'Esportes', equipment:['Nenhum','Elastico','Medicine ball','Caixa','Cardio'], base:['Sprint curto','Sprint em subida','Mudanca de direcao','Salto vertical','Salto horizontal','Pliometria lateral','Drill de agilidade','Carioca drill','Aceleracao 10m','Desaceleracao','Arremesso rotacional','Pogo jump','Shuttle run','Skipping tecnico'] },
    { muscle:'Mobilidade', category:'Mobilidade', equipment:['Nenhum','Elastico','Bola'], base:['Mobilidade de quadril','Mobilidade toracica','Alongamento posterior','Alongamento de peitoral','Alongamento de flexor do quadril','Rotacao de ombro','Mobilidade de tornozelo','Couch stretch','World greatest stretch','Cat cow','Child pose','Dead hang leve','90 90 de quadril','Respiracao diafragmatica'] },
  ];
  const variations = {
    Barra:['com barra','pegada pronada','pegada supinada','pegada fechada','pegada aberta'],
    Halteres:['com halteres','alternado','unilateral','bilateral','no banco inclinado'],
    Maquina:['na maquina','articulado','sentado','unilateral','com pausa'],
    Cabo:['no cabo','com corda','com barra reta','unilateral','alto para baixo'],
    Elastico:['com elastico','com mini band','com pausa','unilateral','bilateral'],
    Kettlebell:['com kettlebell','unilateral','alternado','em circuito'],
    Banco:['no banco','inclinado','declinado','com apoio'],
    Bola:['na bola','com bola suica','com medicine ball'],
    Cardio:['leve','moderado','intervalado','sprint','tempo run'],
    'Faixa/TRX':['no TRX','com faixa','inclinado','unilateral'],
    Anilha:['com anilha','abracando anilha','acima da cabeca'],
    Caixa:['na caixa','com salto','lateral','baixo impacto'],
    'Medicine ball':['com medicine ball','rotacional','acima da cabeca'],
    Nenhum:['livre','isometrico','alternado','com pausa','explosivo'],
  };
  const catalog = [];
  const seen = new Set();
  groups.forEach(g => {
    const meta = GROUP_META[g.muscle] || GROUP_META.Corpo;
    g.base.forEach(base => {
      g.equipment.forEach(eq => {
        (variations[eq] || ['']).forEach(v => {
          const name = v ? `${base} ${v}` : base;
          const id = `cat-${slugify(g.category)}-${slugify(g.muscle)}-${slugify(eq)}-${slugify(name)}`;
          if (seen.has(id)) return;
          seen.add(id);
          catalog.push({
            id, name, muscle:g.muscle, category:g.category, equipment:eq,
            icon:meta.icon, color:meta.color, sets:'', tip:''
          });
        });
      });
    });
  });
  return catalog;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHECKLIST
   ═══════════════════════════════════════════════════════════════════════════ */
function renderChecklist() {
  const el = document.getElementById('checklist-card');
  if (!el) return;

  if (localStorage.getItem(K_CHECKLIST_DISMISSED)) { el.innerHTML = ''; return; }

  const s1 = library.length > 0;
  const s2 = Object.values(workouts).some(w => w && w.length);
  const s3 = history.length > 0;
  const done = [s1, s2, s3].filter(Boolean).length;

  if (done === 3) {
    el.innerHTML = `
      <div class="checklist-card" style="border-color:rgba(200,240,96,.5);text-align:center;padding:18px">
        <div style="font-size:28px;margin-bottom:6px">🎉</div>
        <div class="checklist-title">Configuração concluída!</div>
        <div class="checklist-sub" style="margin-top:4px">Você já sabe usar o app. Bons treinos!</div>
      </div>`;
    setTimeout(() => {
      localStorage.setItem(K_CHECKLIST_DISMISSED, '1');
      el.style.transition = 'opacity .5s, max-height .5s';
      el.style.opacity = '0';
      el.style.maxHeight = '0';
      el.style.overflow = 'hidden';
      setTimeout(() => { el.innerHTML = ''; el.style = ''; }, 520);
    }, 2800);
    return;
  }

  const steps = [
    { done: s1, label: 'Adicionar um exercício',        hint: 'Vá em Biblioteca → + Exercício',               action: `onclick="dismissAndGo('biblioteca')"` },
    { done: s2, label: 'Criar um treino para algum dia', hint: 'Selecione um dia e clique em "Criar treino"',  action: s1 ? `onclick="checklistFocusDay()"` : `onclick="dismissAndGo('biblioteca')"` },
    { done: s3, label: 'Iniciar seu primeiro treino',    hint: 'Clique no botão ▶ no card do treino',          action: s2 ? `` : `onclick="checklistFocusDay()"` },
  ];
  const pct = Math.round((done / 3) * 100);

  el.innerHTML = `
    <div class="checklist-card">
      <div class="checklist-header">
        <div>
          <div class="checklist-title">Primeiros passos</div>
          <div class="checklist-sub">${done} de 3 concluídos — siga a ordem abaixo</div>
        </div>
        <button class="checklist-dismiss" onclick="dismissChecklist()">Dispensar</button>
      </div>
      <div class="checklist-progress">
        <div class="checklist-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="checklist-steps">
        ${steps.map((s, i) => `
          <div class="checklist-step ${s.done ? 'done' : ''}" ${!s.done ? s.action : ''}>
            <div class="step-check">${s.done ? '✓' : (i + 1)}</div>
            <div class="step-body">
              <div class="step-label">${s.label}</div>
              <div class="step-hint">${s.hint}</div>
            </div>
            ${!s.done ? '<span class="step-arrow">→</span>' : ''}
          </div>`).join('')}
      </div>
    </div>`;
}

function dismissChecklist() {
  localStorage.setItem(K_CHECKLIST_DISMISSED, '1');
  const el = document.getElementById('checklist-card');
  el.style.transition = 'opacity .3s, max-height .4s, margin .4s';
  el.style.opacity = '0';
  el.style.maxHeight = '0';
  el.style.overflow = 'hidden';
  el.style.marginBottom = '0';
  setTimeout(() => { el.innerHTML = ''; el.style = ''; }, 420);
}

function dismissAndGo(tab) { switchTab(tab); }
function checklistFocusDay() {
  document.getElementById('day-strip').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════════════════ */
function switchTab(tab) {
  ['treinos','historico','biblioteca','timer'].forEach(t => {
    document.getElementById('sec-'+t).classList.toggle('active', t===tab);
  });
  document.querySelectorAll('.tab, .bnav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab===tab)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════════════════════════ */
function renderStats() {
  const days = Object.values(workouts).filter(w=>w&&w.length).length;
  document.getElementById('header-stats').innerHTML = `
    <div class="stat-pill">
      <span class="stat-num">${library.length}</span>
      <span class="stat-lbl">Exerc.</span>
    </div>
    <div class="stat-pill">
      <span class="stat-num">${days}</span>
      <span class="stat-lbl">Dias</span>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DAY STRIP
   ═══════════════════════════════════════════════════════════════════════════ */
function renderDayStrip() {
  document.getElementById('day-strip').innerHTML = DAYS_SHORT.map((d,i) => `
    <div class="day-cell ${workouts[i]&&workouts[i].length?'has-workout':''} ${i===selDay?'selected':''}" onclick="selectDay(${i})">
      <span class="day-letter">${d}</span>
      <div class="day-dot"></div>
      ${i===WEEKDAY?'<span class="day-today-dot">●</span>':'<span style="height:10px;display:block"></span>'}
    </div>`).join('');
}

function selectDay(i) { selDay=i; renderDayStrip(); renderDayContent(); }

/* ═══════════════════════════════════════════════════════════════════════════
   DAY CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */
function renderDayContent() {
  const c  = document.getElementById('day-content');
  const ws = workouts[selDay] || [];

  const hdr = `<div class="day-header">
    <div class="day-header-name">${DAYS_FULL[selDay]}${selDay===WEEKDAY?' <span>(hoje)</span>':''}</div>
  </div>`;

  if (!ws.length) {
    c.innerHTML = hdr + `
      <div class="day-empty">Nenhum treino em <strong>${DAYS_FULL[selDay]}</strong>.<br>
        <span style="font-size:12px">Dia de descanso, ou crie um treino abaixo.</span></div>
      <div class="day-actions">
        <button class="btn-ghost" onclick="openWorkoutModal(${selDay},null)">
          <i class="ph ph-pencil-simple"></i> Criar treino
        </button>
      </div>`;
    return;
  }

  const cards = ws.map((w,wi) => {
    const valid = w.exIds.filter(id=>library.find(e=>e.id===id));
    const rows  = w.exIds.map(id=>{
      const ex=library.find(e=>e.id===id); if(!ex) return '';
      return `<div class="ex-row">
        <div class="ex-ico" style="background:${ex.color}22">${ex.icon||'💪'}</div>
        <div class="ex-meta">
          <div class="ex-title">${ex.name}</div>
          ${ex.tip?`<div class="ex-sub">${ex.tip}</div>`:''}
        </div>
        <span class="ex-muscle-tag" style="color:${ex.color};border:1px solid ${ex.color}33">${ex.muscle}</span>
        ${ex.sets?`<span class="ex-sets-tag" style="color:var(--muted)">${ex.sets}</span>`:''}
      </div>`;
    }).join('');

    return `<div class="workout-card">
      <div class="wcard-header">
        <div class="wcard-left">
          <span class="wcard-name">${w.name}</span>
          <span class="wcard-badge">${valid.length} exercício${valid.length!==1?'s':''}</span>
        </div>
        <div class="wcard-actions">
          <button class="icon-btn play" onclick="startActiveWorkout(${selDay},${wi})" title="Iniciar treino">
            <i class="ph ph-play-circle"></i>
          </button>
          <button class="icon-btn edit" onclick="openWorkoutModal(${selDay},${wi})" title="Editar">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="icon-btn del"  onclick="confirmDeleteWorkout(${selDay},${wi})" title="Remover">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
      ${rows||`<div style="padding:12px 14px;font-size:12px;color:var(--muted)">Exercícios removidos da biblioteca.</div>`}
    </div>`;
  }).join('');

  c.innerHTML = hdr + cards + `
    <div class="day-actions">
      <button class="btn-ghost" onclick="openWorkoutModal(${selDay},null)">
        <i class="ph ph-plus"></i> Novo treino
      </button>
    </div>`;
}

function confirmDeleteWorkout(day,wi) {
  showConfirm('Remover treino', `Remover o treino "<strong>${workouts[day][wi].name}</strong>"?`, () => {
    workouts[day].splice(wi,1);
    if(!workouts[day].length) delete workouts[day];
    save(K_WORKOUTS,workouts);
    renderDayStrip(); renderDayContent(); renderStats();
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORKOUT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function openWorkoutModal(day, wi) {
  wkDay=day; wkEditIdx=wi; wkFilter='Todos';
  if(wi!==null && workouts[day]?.[wi]) {
    const w=workouts[day][wi];
    document.getElementById('wk-name').value=w.name;
    wkSel=[...w.exIds];
  } else {
    document.getElementById('wk-name').value='';
    wkSel=[];
  }
  document.getElementById('wk-modal-title').textContent = wi!==null ? 'Editar Treino' : `Treino de ${DAYS_FULL[day]}`;
  renderWkFilters(); renderWkPicker(); renderWkSelected();
  document.getElementById('overlay-workout').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeWorkoutModal() {
  document.getElementById('overlay-workout').classList.remove('open');
  document.body.style.overflow='';
}

function renderWkFilters() {
  const muscles=['Todos',...new Set(library.map(e=>e.muscle))];
  document.getElementById('wk-filter-row').innerHTML=muscles.map(m=>
    `<button class="filter-btn ${m===wkFilter?'active':''}" onclick="setWkFilter('${m}')">${m}</button>`
  ).join('');
}
function setWkFilter(m){wkFilter=m;renderWkFilters();renderWkPicker();}

function renderWkPicker() {
  const list=document.getElementById('wk-ex-list');
  const empty=document.getElementById('wk-lib-empty');
  if(!library.length){list.style.display='none';empty.style.display='block';return;}
  list.style.display='flex';empty.style.display='none';
  const filtered=wkFilter==='Todos'?library:library.filter(e=>e.muscle===wkFilter);
  list.innerHTML=filtered.map(ex=>{
    const chk=wkSel.includes(ex.id);
    return `<div class="pick-item ${chk?'checked':''}" onclick="toggleWkEx('${ex.id}')">
      <span class="pick-ico">${ex.icon||'💪'}</span>
      <div class="pick-info"><div class="pick-name">${ex.name}</div><div class="pick-sub">${ex.muscle}${ex.sets?' · '+ex.sets:''}</div></div>
      <div class="pick-check">${chk?'✓':'+'}</div>
    </div>`;
  }).join('');
}

function toggleWkEx(id){
  const p=wkSel.indexOf(id);
  p===-1?wkSel.push(id):wkSel.splice(p,1);
  renderWkPicker(); renderWkSelected();
}

function renderWkSelected() {
  const wrap=document.getElementById('wk-selected-list');
  document.getElementById('wk-count').textContent=wkSel.length;
  if(!wkSel.length){wrap.innerHTML='<div class="wk-empty-sel">Nenhum exercício selecionado.</div>';return;}
  wrap.innerHTML=wkSel.map((id,pos)=>{
    const ex=library.find(e=>e.id===id); if(!ex) return '';
    return `<div class="sel-item" draggable="true"
        ondragstart="dragStart(${pos})" ondragover="dragOver(event,${pos})"
        ondrop="dragDrop(event,${pos})" ondragend="dragEnd()"
        data-pos="${pos}">
      <i class="ph ph-dots-six-vertical drag-handle"></i>
      <span>${ex.icon||'💪'}</span>
      <span class="sel-name">${ex.name}</span>
      ${ex.sets?`<span class="sel-sets">${ex.sets}</span>`:''}
      <button class="sel-remove" onclick="removeWkSel(${pos})"><i class="ph ph-x"></i></button>
    </div>`;
  }).join('');
}

function removeWkSel(pos){wkSel.splice(pos,1);renderWkPicker();renderWkSelected();}

function dragStart(i){dragSrcIdx=i;}
function dragOver(e,i){
  e.preventDefault();
  document.querySelectorAll('.sel-item').forEach((el,idx)=>el.classList.toggle('drag-over',idx===i));
}
function dragDrop(e,i){
  e.preventDefault();
  if(dragSrcIdx===null||dragSrcIdx===i) return;
  const [moved]=wkSel.splice(dragSrcIdx,1);
  wkSel.splice(i,0,moved);
  renderWkSelected(); renderWkPicker();
}
function dragEnd(){
  dragSrcIdx=null;
  document.querySelectorAll('.sel-item').forEach(el=>el.classList.remove('drag-over','dragging'));
}

function saveWorkout() {
  const name=document.getElementById('wk-name').value.trim();
  if(!name){
    const inp=document.getElementById('wk-name');
    inp.style.borderColor='var(--red)'; inp.focus();
    setTimeout(()=>inp.style.borderColor='',1500); return;
  }
  if(!wkSel.length){alert('Selecione pelo menos um exercício.');return;}
  const obj={name,exIds:[...wkSel]};
  if(!workouts[wkDay]) workouts[wkDay]=[];
  wkEditIdx!==null?workouts[wkDay][wkEditIdx]=obj:workouts[wkDay].push(obj);
  save(K_WORKOUTS,workouts);
  closeWorkoutModal();
  renderDayStrip(); renderDayContent(); renderStats(); renderChecklist();
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVE WORKOUT MODE
   ═══════════════════════════════════════════════════════════════════════════ */
function startActiveWorkout(day, wi) {
  const w = workouts[day][wi];
  const validIds = w.exIds.filter(id=>library.find(e=>e.id===id));
  if(!validIds.length){alert('Nenhum exercício válido neste treino.');return;}
  activeWk    = {name:w.name, exIds:validIds, dayIndex:day, workoutName:w.name};
  activeCur   = 0;
  activeStart = Date.now();
  stopRestTimer();
  clearInterval(elapsedInterval);

  document.getElementById('active-screen').classList.add('open');
  document.getElementById('active-finish').style.display='none';
  document.getElementById('active-ex-view').style.display='flex';
  document.body.style.overflow='hidden';
  renderActiveExercise();

  /* ── Elapsed timer: atualiza a cada segundo ── */
  elapsedInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - activeStart) / 1000);
    document.getElementById('active-elapsed').textContent = formatElapsed(secs);
  }, 1000);
}

function renderActiveExercise() {
  const ids  = activeWk.exIds;
  const ex   = library.find(e=>e.id===ids[activeCur]);
  if(!ex) return;

  document.getElementById('active-wk-name').textContent       = activeWk.name;
  document.getElementById('active-progress-label').textContent = `${activeCur+1} / ${ids.length}`;
  document.getElementById('active-progress-fill').style.width  = `${((activeCur+1)/ids.length)*100}%`;

  const card=document.getElementById('active-ex-card');
  card.style.animation='none'; card.offsetHeight; card.style.animation='';

  document.getElementById('active-ex-icon').textContent    = ex.icon||'💪';
  document.getElementById('active-ex-name').textContent    = ex.name;
  document.getElementById('active-ex-sets').textContent    = ex.sets||'';
  document.getElementById('active-ex-tip').textContent     = ex.tip||'';
  document.getElementById('active-ex-muscle').textContent  = ex.muscle;
  document.getElementById('active-ex-muscle').style.color  = ex.color;

  document.getElementById('active-prev').disabled = activeCur===0;
  document.getElementById('active-next').innerHTML =
    activeCur===ids.length-1
      ? '<i class="ph ph-flag-checkered"></i> Concluir'
      : 'Próximo <i class="ph ph-arrow-right"></i>';
}

function activeNav(dir) {
  stopRestTimer();
  if(dir===1 && activeCur===activeWk.exIds.length-1) {
    finishWorkout(); return;
  }
  activeCur = Math.max(0, Math.min(activeWk.exIds.length-1, activeCur+dir));
  renderActiveExercise();
}

function finishWorkout() {
  stopRestTimer();
  clearInterval(elapsedInterval);
  const totalSecs  = Math.floor((Date.now()-activeStart)/1000);
  const duration   = Math.max(1, Math.round(totalSecs/60));

  const entry = {
    id:       Date.now().toString(36),
    date:     new Date().toISOString(),
    wkName:   activeWk.name,
    exIds:    [...activeWk.exIds],
    duration,
    dayIndex: activeWk.dayIndex,
  };
  history.unshift(entry);
  if(history.length>100) history.pop();
  save(K_HISTORY, history);

  document.getElementById('active-ex-view').style.display='none';
  document.getElementById('active-finish').style.display='flex';
  document.getElementById('active-progress-fill').style.width='100%';

  const subs=['Mandou muito bem!','Continue assim!','Cada treino conta!','Você é incrível!'];
  document.getElementById('finish-sub').textContent = subs[Math.floor(Math.random()*subs.length)];

  /* Mostra tempo formatado no resumo final */
  const timeLabel = totalSecs >= 3600
    ? formatElapsed(totalSecs)
    : `${duration} min`;

  document.getElementById('finish-stats').innerHTML = `
    <div class="finish-stat">
      <span class="finish-stat-num">${activeWk.exIds.length}</span>
      <span class="finish-stat-lbl">Exercícios</span>
    </div>
    <div class="finish-stat">
      <span class="finish-stat-num">${timeLabel}</span>
      <span class="finish-stat-lbl">Tempo</span>
    </div>`;

  spawnConfetti();
  renderHistory();
}

function closeActiveWorkout() {
  clearInterval(elapsedInterval);
  stopRestTimer();
  document.getElementById('active-screen').classList.remove('open');
  document.body.style.overflow='';
  renderChecklist();
}

function confirmStopWorkout() {
  showConfirm('Sair do treino','Deseja sair? O progresso não será salvo no histórico.',()=>{
    clearInterval(elapsedInterval);
    stopRestTimer();
    document.getElementById('active-screen').classList.remove('open');
    document.body.style.overflow='';
  });
}

/* Rest timer */
function startRestTimer(secs) {
  stopRestTimer();
  restRemain = secs;
  document.getElementById('active-timer-mini').style.display='flex';
  updateRestUI();
  restInterval = setInterval(()=>{
    restRemain--;
    updateRestUI();
    if(restRemain<=0) stopRestTimer();
  },1000);
}
function stopRestTimer() {
  clearInterval(restInterval);
  const el = document.getElementById('active-timer-mini');
  if(el) el.style.display='none';
}
function updateRestUI() {
  const m=Math.floor(restRemain/60), s=restRemain%60;
  document.getElementById('active-timer-val').textContent =
    String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFETTI
   ═══════════════════════════════════════════════════════════════════════════ */
function spawnConfetti() {
  const wrap=document.getElementById('confetti-wrap');
  wrap.innerHTML='';
  const colors=['#c8f060','#3ecfb0','#ff5f5f','#facc15','#60a5fa','#f472b6'];
  for(let i=0;i<60;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`
      left:${Math.random()*100}%;
      background:${colors[i%colors.length]};
      animation-delay:${Math.random()*1.2}s;
      animation-duration:${1.8+Math.random()*1.5}s;
      transform:rotate(${Math.random()*360}deg);
      border-radius:${Math.random()>0.5?'50%':'2px'};
    `;
    wrap.appendChild(el);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORY
   ═══════════════════════════════════════════════════════════════════════════ */
function renderHistory() {
  const list  = document.getElementById('hist-list');
  const empty = document.getElementById('hist-empty');

  const streak = calcStreak();
  document.getElementById('streak-badge').innerHTML =
    `<span class="streak-num">${streak}</span><span class="streak-lbl">🔥 sequência</span>`;

  if(!history.length){ list.innerHTML=''; empty.style.display='flex'; return; }
  empty.style.display='none';

  list.innerHTML = history.slice(0,50).map(h=>{
    const d = new Date(h.date);
    const exNames = h.exIds
      .map(id=>library.find(e=>e.id===id)?.name)
      .filter(Boolean).slice(0,4);
    const more = h.exIds.length - exNames.length;
    const durLabel = formatDuration(h.duration);
    return `<div class="hist-entry">
      <div class="hist-date-col">
        <span class="hist-day-num">${d.getDate()}</span>
        <span class="hist-month">${MONTHS_SHORT[d.getMonth()]}</span>
      </div>
      <div class="hist-divider"></div>
      <div class="hist-info">
        <div class="hist-wk-name">${h.wkName}</div>
        <div class="hist-day-name">${DAYS_FULL[h.dayIndex]}</div>
        <div class="hist-ex-pills">
          ${exNames.map(n=>`<span class="hist-pill">${n}</span>`).join('')}
          ${more>0?`<span class="hist-pill">+${more}</span>`:''}
        </div>
        ${durLabel?`<div class="hist-duration"><i class="ph ph-clock" style="font-size:11px"></i> ${durLabel}</div>`:''}
      </div>
      <div class="hist-actions">
        <button class="icon-btn edit" onclick="openHistEditModal('${h.id}')" title="Editar">
          <i class="ph ph-pencil-simple"></i>
        </button>
        <button class="icon-btn del" onclick="confirmDeleteHistory('${h.id}')" title="Apagar">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ── Apagar histórico ─────────────────────────────────────────────────────── */
function confirmDeleteHistory(id) {
  const h = history.find(e => e.id === id);
  if (!h) return;
  const d = new Date(h.date);
  const label = `${h.wkName} — ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  showConfirm('Apagar registro', `Apagar "<strong>${label}</strong>" do histórico?<br><span style="font-size:11px;color:var(--muted)">Isso pode afetar a contagem da sequência.</span>`, () => {
    history = history.filter(e => e.id !== id);
    save(K_HISTORY, history);
    renderHistory();
  });
}

/* ── Editar histórico ─────────────────────────────────────────────────────── */
function openHistEditModal(id) {
  const h = history.find(e => e.id === id);
  if (!h) return;
  histEditId = id;

  const d = new Date(h.date);
  // Formata data para input type="date" (YYYY-MM-DD)
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const dd   = String(d.getDate()).padStart(2,'0');

  document.getElementById('hist-edit-name').value     = h.wkName;
  document.getElementById('hist-edit-date').value     = `${yyyy}-${mm}-${dd}`;
  document.getElementById('hist-edit-duration').value = h.duration || '';
  document.getElementById('hist-edit-day').value      = String(h.dayIndex);

  document.getElementById('overlay-hist-edit').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('hist-edit-name').focus(), 80);
}

function closeHistEditModal() {
  document.getElementById('overlay-hist-edit').classList.remove('open');
  document.body.style.overflow='';
  histEditId = null;
}

function saveHistEdit() {
  const name     = document.getElementById('hist-edit-name').value.trim();
  const dateVal  = document.getElementById('hist-edit-date').value;
  const duration = parseInt(document.getElementById('hist-edit-duration').value) || null;
  const dayIndex = parseInt(document.getElementById('hist-edit-day').value);

  if(!name){ 
    const inp = document.getElementById('hist-edit-name');
    inp.style.borderColor='var(--red)'; inp.focus();
    setTimeout(()=>inp.style.borderColor='',1500); return;
  }

  const idx = history.findIndex(e => e.id === histEditId);
  if(idx === -1) return;

  // Preserva hora original, troca só a data
  const originalDate = new Date(history[idx].date);
  let newDate;
  if(dateVal) {
    const [y,m,d] = dateVal.split('-').map(Number);
    newDate = new Date(y, m-1, d,
      originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds()
    );
  } else {
    newDate = originalDate;
  }

  history[idx] = {
    ...history[idx],
    wkName:   name,
    date:     newDate.toISOString(),
    duration: duration,
    dayIndex: dayIndex,
  };

  // Reordena histórico por data (mais recente primeiro)
  history.sort((a,b) => new Date(b.date) - new Date(a.date));
  save(K_HISTORY, history);
  closeHistEditModal();
  renderHistory();
}

function confirmDeleteHistFromEdit() {
  closeHistEditModal();
  setTimeout(() => confirmDeleteHistory(histEditId), 200);
}

/* ─────────────────────────────────────────────────────────────────────────── */
function calcStreak() {
  if(!history.length) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const days  = [...new Set(history.map(h=>{
    const d=new Date(h.date); d.setHours(0,0,0,0); return d.getTime();
  }))].sort((a,b)=>b-a);
  let streak=0, cur=today.getTime();
  for(const d of days){
    if(d===cur){ streak++; cur-=86400000; }
    else if(d===cur+86400000){ streak++; cur=d-86400000; }
    else break;
  }
  return streak;
}


function setLibFilter(m){libFilter=m;renderLibrary();}

function setLibraryMode(mode) {
  libraryMode = mode;
  libSelectMode = false;
  libSelected.clear();
  catalogSelectMode = false;
  catalogSelected.clear();
  const search = document.getElementById('lib-search');
  if (search) { search.value = ''; search.placeholder = mode === 'catalog' ? 'Buscar no catálogo...' : 'Buscar exercício...'; }
  // Reset catalog filters when switching to catalog
  if (mode === 'catalog') {
    const cat = document.getElementById('catalog-category');
    if (cat) { cat.value = 'Todos'; }
    const mus = document.getElementById('catalog-muscle');
    if (mus) { mus.value = 'Todos'; }
    const eq = document.getElementById('catalog-equipment');
    if (eq) { eq.value = 'Todos'; }
  }
  renderLibrary();
}

function ensureCatalogFilters() {
  const cat = document.getElementById('catalog-category');
  if (!cat) return;
  // Only populate if empty (first time) to preserve user selections
  if (!cat.options.length) {
    const MUSCLE_ORDER = ['Todos','Peito','Costas','Pernas','Gluteos','Ombros','Biceps','Triceps','Abdomen','Cardio','Mobilidade','Corpo'];
    cat.innerHTML = ['Todos',...CATALOG_CATEGORIES].map(v=>`<option value="${v}">${v}</option>`).join('');
    document.getElementById('catalog-muscle').innerHTML = MUSCLE_ORDER.map(v=>`<option value="${v}">${v}</option>`).join('');
    document.getElementById('catalog-equipment').innerHTML = EQUIPMENT_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join('');
  }
}

function getFilteredCatalog(ignoreQuery=false) {
  ensureCatalogFilters();
  const category = document.getElementById('catalog-category')?.value || 'Todos';
  const muscle = document.getElementById('catalog-muscle')?.value || 'Todos';
  const equipment = document.getElementById('catalog-equipment')?.value || 'Todos';
  const query = ignoreQuery ? '' : (document.getElementById('lib-search')?.value || '').toLowerCase().trim();
  return exerciseCatalog.filter(ex => {
    const matchCategory = category === 'Todos' || ex.category === category;
    const matchMuscle = muscle === 'Todos' || ex.muscle === muscle;
    const matchEquipment = equipment === 'Todos' || ex.equipment === equipment;
    const matchQuery = !query || ex.name.toLowerCase().includes(query) || ex.muscle.toLowerCase().includes(query) ||
      ex.category.toLowerCase().includes(query) || ex.equipment.toLowerCase().includes(query);
    return matchCategory && matchMuscle && matchEquipment && matchQuery;
  });
}

function isCatalogImported(catId) {
  return library.some(ex => ex.catalogId === catId || ex.id === catId);
}

function catalogActionButton(ex) {
  if (isCatalogImported(ex.id)) {
    return `<button class="icon-btn imported" title="Ja importado"><i class="ph ph-check"></i></button>`;
  }
  return `<button class="icon-btn play" onclick="importCatalogExercise('${ex.id}')" title="Adicionar"><i class="ph ph-plus"></i></button>`;
}

function importCatalogExercise(catId, silent=false) {
  const ex = exerciseCatalog.find(item => item.id === catId);
  if (!ex || isCatalogImported(catId)) return false;
  library.push({
    ...ex,
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    catalogId: ex.id,
    _userImported: true,
    sets: '',
    tip: '',
  });
  save(K_LIB, library);
  if (!silent) {
    renderLibrary(); renderStats(); renderChecklist();
  }
  return true;
}

function importFilteredCatalog() {
  const items = getFilteredCatalog();
  let added = 0;
  items.forEach(ex => { if (importCatalogExercise(ex.id, true)) added++; });
  save(K_LIB, library);
  renderLibrary(); renderStats(); renderChecklist();
  showConfirm('Importados!', `${added} exercício${added!==1?'s':''} adicionado${added!==1?'s':''} à sua biblioteca.`, () => {});
}

function renderLibrary() {
  ensureCatalogFilters();
  const isCatalog = libraryMode === 'catalog';
  const query = (document.getElementById('lib-search')?.value || '').toLowerCase().trim();
  const filterEl = document.getElementById('lib-filter-row');
  const tools    = document.getElementById('catalog-tools');
  const summary  = document.getElementById('catalog-summary');

  document.getElementById('lib-mode-my')?.classList.toggle('active', !isCatalog);
  document.getElementById('lib-mode-catalog')?.classList.toggle('active', isCatalog);
  if (tools)   tools.style.display   = isCatalog ? 'grid' : 'none';
  if (summary) summary.style.display = isCatalog ? 'block' : 'none';

  /* ── Update section subtitle ── */
  const sub = document.getElementById('lib-section-sub');
  if (sub) sub.textContent = isCatalog ? 'Catálogo de exercícios' : 'Seus exercícios pessoais';

  /* ── Update toolbar actions ── */
  const toolbarActions = document.getElementById('lib-toolbar-actions');
  if (toolbarActions) {
    if (!isCatalog && libSelectMode) {
      toolbarActions.innerHTML = `
        <div class="lib-select-bar">
          <button class="tbtn sm" onclick="selectAllLib()">
            <i class="ph ph-check-square"></i> Todos
          </button>
          <button class="tbtn sm" onclick="deselectAllLib()">
            <i class="ph ph-square"></i> Nenhum
          </button>
          <button class="tbtn sm danger" onclick="deleteSelectedLib()">
            <i class="ph ph-trash"></i>${libSelected.size>0?' Excluir ('+libSelected.size+')':' Excluir'}
          </button>
          <button class="tbtn sm" onclick="exitLibSelectMode()">Cancelar</button>
        </div>`;
    } else if (isCatalog && catalogSelectMode) {
      toolbarActions.innerHTML = `
        <div class="lib-select-bar">
          <button class="tbtn sm" onclick="deselectAllCatalog()">
            <i class="ph ph-square"></i> Nenhum
          </button>
          <button class="tbtn sm" style="background:var(--accent);color:#000" onclick="importSelectedCatalog()">
            <i class="ph ph-plus-circle"></i> Adicionar (${catalogSelected.size})
          </button>
          <button class="tbtn sm" onclick="exitCatalogSelectMode()">Cancelar</button>
        </div>`;
    } else {
      toolbarActions.innerHTML = `
        <div class="lib-toolbar-actions-wrap">
          ${isCatalog
            ? `<button class="tbtn sm" onclick="enterCatalogSelectMode()" title="Selecionar para adicionar">
                <i class="ph ph-check-square"></i> Selecionar
               </button>`
            : `<button class="btn-accent" onclick="openExModal(null)">
                <i class="ph ph-plus"></i><span class="tbtn-label"> Exercício</span>
               </button>
               ${library.length > 0
                 ? `<button class="tbtn sm" onclick="enterLibSelectMode()" title="Selecionar para excluir">
                     <i class="ph ph-check-square"></i>
                    </button>`
                 : ''}`}
        </div>`;
    }
  }

  let filtered;
  if (isCatalog) {
    filtered = getFilteredCatalog();
    filterEl.innerHTML = '';
    const MAX_CATALOG = 150;
    const showing = filtered.slice(0, MAX_CATALOG);
    if (summary) summary.innerHTML = `Mostrando <strong>${showing.length}</strong> de ${filtered.length} exercícios encontrados (${exerciseCatalog.length} no total).
      ${filtered.length > 0 ? `<button class="tbtn sm" style="margin-left:8px;vertical-align:middle" onclick="importFilteredCatalog()"><i class="ph ph-plus-circle"></i> Importar filtrados</button>` : ''}
      ${filtered.length > MAX_CATALOG ? `<span style="color:var(--muted);font-size:11px;display:block;margin-top:4px">Use os filtros acima para refinar.</span>` : ''}`;
    filtered = showing;
  } else {
    const muscles = ['Todos',...new Set(library.map(e=>e.muscle))];
    filterEl.innerHTML = library.length
      ? muscles.map(m=>`<button class="filter-btn ${m===libFilter?'active':''}" onclick="setLibFilter('${m}')">${m}</button>`).join('')
      : '';
    filtered = libFilter==='Todos' ? library : library.filter(e=>e.muscle===libFilter);
    if (query) filtered = filtered.filter(e=>
      e.name.toLowerCase().includes(query) ||
      e.muscle.toLowerCase().includes(query) ||
      (e.category||'').toLowerCase().includes(query) ||
      (e.equipment||'').toLowerCase().includes(query)
    );
  }

  const grid  = document.getElementById('lib-grid');
  const empty = document.getElementById('lib-empty');
  if (!isCatalog && !library.length) { grid.style.display='none'; empty.style.display='flex'; return; }
  grid.style.display='grid'; empty.style.display='none';

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);font-size:13px">Nenhum exercício encontrado.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ex => {
    if (isCatalog) {
      const imported   = isCatalogImported(ex.id);
      const isSelCat   = catalogSelected.has(ex.id);
      if (catalogSelectMode) {
        return `<div class="lib-card lib-card-selectable ${isSelCat?'lib-card-selected':''} ${imported?'lib-card-imported':''}"
            data-cat-id="${ex.id}"
            onclick="toggleCatalogSelect('${ex.id}')">
          <div class="lib-card-top">
            <span class="lib-card-icon">${ex.icon||'💪'}</span>
            <div class="lib-card-actions" style="opacity:1">
              <div class="lib-card-checkbox ${isSelCat?'checked':''}">
                ${isSelCat?'<i class="ph ph-check"></i>':''}
              </div>
            </div>
          </div>
          <div class="lib-card-name">${ex.name}</div>
          <div class="lib-card-muscle"><span class="muscle-dot" style="background:${ex.color}"></span>${ex.muscle}</div>
          ${ex.category ? `<div class="lib-card-sets">${ex.category}${ex.equipment?' · '+ex.equipment:''}</div>` : ''}
          ${imported ? `<div class="lib-card-tip" style="color:var(--teal)">✓ Já na biblioteca</div>` : ''}
        </div>`;
      }
      return `<div class="lib-card">
        <div class="lib-card-top">
          <span class="lib-card-icon">${ex.icon||'💪'}</span>
          <div class="lib-card-actions" style="opacity:1">
            <button class="icon-btn edit" onclick="editCatalogExercise('${ex.id}')" title="Editar e importar">
              <i class="ph ph-pencil-simple"></i>
            </button>
            ${imported
              ? `<button class="icon-btn imported" title="Já importado"><i class="ph ph-check"></i></button>`
              : `<button class="icon-btn play" onclick="quickAddCatalogEx('${ex.id}')" title="Adicionar à biblioteca">
                  <i class="ph ph-plus"></i>
                </button>`}
          </div>
        </div>
        <div class="lib-card-name">${ex.name}</div>
        <div class="lib-card-muscle"><span class="muscle-dot" style="background:${ex.color}"></span>${ex.muscle}</div>
        ${ex.category ? `<div class="lib-card-sets">${ex.category}${ex.equipment?' · '+ex.equipment:''}</div>` : ''}
        ${imported ? `<div class="lib-card-tip" style="color:var(--teal)">✓ Na sua biblioteca</div>` : ''}
      </div>`;
    } else {
      const isSelected = libSelected.has(ex.id);
      return `<div class="lib-card ${libSelectMode?'lib-card-selectable':''} ${isSelected?'lib-card-selected':''}"
          data-lib-id="${ex.id}"
          ${libSelectMode ? `onclick="toggleLibSelect('${ex.id}')"` : ''}>
        <div class="lib-card-top">
          <span class="lib-card-icon">${ex.icon||'💪'}</span>
          <div class="lib-card-actions" ${libSelectMode?'style="opacity:1"':''}>
            ${libSelectMode
              ? `<div class="lib-card-checkbox ${isSelected?'checked':''}">
                  ${isSelected?'<i class="ph ph-check"></i>':''}
                </div>`
              : `<button class="icon-btn edit" onclick="openExModal('${ex.id}')" title="Editar">
                  <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="icon-btn del" onclick="confirmDeleteEx('${ex.id}')" title="Remover">
                  <i class="ph ph-trash"></i>
                </button>`}
          </div>
        </div>
        <div class="lib-card-name">${ex.name}</div>
        <div class="lib-card-muscle"><span class="muscle-dot" style="background:${ex.color}"></span>${ex.muscle}</div>
        ${ex.sets?`<div class="lib-card-sets">${ex.sets}</div>`:''}
        ${ex.tip?`<div class="lib-card-tip">${ex.tip}</div>`:''}
      </div>`;
    }
  }).join('');
}

function confirmDeleteEx(id) {
  const ex=library.find(e=>e.id===id);
  showConfirm('Remover exercício',`Remover "<strong>${ex?.name}</strong>" da biblioteca?`,()=>{
    library=library.filter(e=>e.id!==id);
    save(K_LIB,library);
    Object.keys(workouts).forEach(day=>{
      workouts[day]=workouts[day].map(w=>({...w,exIds:w.exIds.filter(eid=>eid!==id)}));
    });
    save(K_WORKOUTS,workouts);
    renderLibrary(); renderStats();
  });
}

/* ─── Library selection mode ─────────────────────────────────────────────── */
function enterLibSelectMode() {
  libSelectMode = true;
  libSelected.clear();
  renderLibrary();
}

function exitLibSelectMode() {
  libSelectMode = false;
  libSelected.clear();
  renderLibrary();
}

function toggleLibSelect(id) {
  libSelected.has(id) ? libSelected.delete(id) : libSelected.add(id);
  // Update just the card and the delete button count instead of full re-render
  const card = document.querySelector(`.lib-card[data-lib-id="${id}"]`);
  if (card) {
    const isSelected = libSelected.has(id);
    card.classList.toggle('lib-card-selected', isSelected);
    const cb = card.querySelector('.lib-card-checkbox');
    if (cb) { cb.className = `lib-card-checkbox${isSelected?' checked':''}`; cb.innerHTML = isSelected?'<i class="ph ph-check"></i>':''; }
  }
  // Update the delete button count
  const delBtn = document.querySelector('.lib-select-bar .danger');
  if (delBtn) delBtn.innerHTML = `<i class="ph ph-trash"></i>${libSelected.size>0?' Excluir ('+libSelected.size+')':' Excluir'}`;
}

function selectAllLib() {
  const query = (document.getElementById('lib-search')?.value||'').toLowerCase().trim();
  let filtered = libFilter==='Todos' ? library : library.filter(e=>e.muscle===libFilter);
  if (query) filtered = filtered.filter(e=>e.name.toLowerCase().includes(query)||e.muscle.toLowerCase().includes(query));
  filtered.forEach(ex => libSelected.add(ex.id));
  renderLibrary();
}

function deselectAllLib() {
  libSelected.clear();
  renderLibrary();
}

function deleteSelectedLib() {
  if (!libSelected.size) return;
  const count = libSelected.size;
  showConfirm(
    'Excluir selecionados',
    `Excluir <strong>${count} exercício${count>1?'s':''}</strong> da biblioteca?<br><span style="font-size:11px;color:var(--muted)">Eles serão removidos de todos os treinos.</span>`,
    () => {
      const toDelete = new Set(libSelected);
      library = library.filter(e => !toDelete.has(e.id));
      Object.keys(workouts).forEach(day => {
        workouts[day] = workouts[day].map(w => ({
          ...w, exIds: w.exIds.filter(eid => !toDelete.has(eid))
        }));
        workouts[day] = workouts[day].filter(w => w.exIds.length > 0);
        if (!workouts[day].length) delete workouts[day];
      });
      save(K_LIB, library);
      save(K_WORKOUTS, workouts);
      libSelectMode = false;
      libSelected.clear();
      renderLibrary(); renderStats(); renderDayStrip(); renderDayContent();
    }
  );
}

/* ─── Catalog selection mode ─────────────────────────────────────────────── */
function enterCatalogSelectMode() {
  catalogSelectMode = true;
  catalogSelected.clear();
  renderLibrary();
}

function exitCatalogSelectMode() {
  catalogSelectMode = false;
  catalogSelected.clear();
  renderLibrary();
}

function toggleCatalogSelect(id) {
  const ex = exerciseCatalog.find(e => e.id === id);
  if (!ex || isCatalogImported(id)) return;
  catalogSelected.has(id) ? catalogSelected.delete(id) : catalogSelected.add(id);
  // Update just the card UI
  const card = document.querySelector(`.lib-card[data-cat-id="${id}"]`);
  if (card) {
    const isSelCat = catalogSelected.has(id);
    card.classList.toggle('lib-card-selected', isSelCat);
    const cb = card.querySelector('.lib-card-checkbox');
    if (cb) { cb.className = `lib-card-checkbox${isSelCat?' checked':''}`; cb.innerHTML = isSelCat?'<i class="ph ph-check"></i>':''; }
  }
  // Update the add button count
  const addBtn = document.querySelector('.lib-select-bar button[onclick="importSelectedCatalog()"]');
  if (addBtn) addBtn.innerHTML = `<i class="ph ph-plus-circle"></i> Adicionar (${catalogSelected.size})`;
}

function deselectAllCatalog() {
  catalogSelected.clear();
  renderLibrary();
}

function importSelectedCatalog() {
  if (!catalogSelected.size) return;
  const count = catalogSelected.size;
  let added = 0;
  catalogSelected.forEach(id => { if (importCatalogExercise(id, true)) added++; });
  save(K_LIB, library);
  catalogSelectMode = false;
  catalogSelected.clear();
  renderLibrary(); renderStats(); renderChecklist();
  showConfirm('Adicionados!', `${added} exercício${added!==1?'s':''} adicionado${added!==1?'s':''} à sua biblioteca.`, () => {});
}

/* ─── Catalog quick-add and edit ─────────────────────────────────────────── */
function quickAddCatalogEx(catId) {
  const added = importCatalogExercise(catId, false);
  if (!added) renderLibrary();
}

function editCatalogExercise(catId) {
  const cat = exerciseCatalog.find(e => e.id === catId);
  if (!cat) return;
  catalogEditId = catId;
  exEditId = null;
  document.getElementById('ex-modal-title').innerHTML =
    `<span>Editar do Catálogo</span>
     <span class="modal-edit-badge" style="margin-left:8px"><i class="ph ph-pencil-simple"></i> Importar personalizado</span>`;
  const muscles = [...new Set(library.map(e => e.muscle))];
  document.getElementById('muscle-list').innerHTML = muscles.map(m=>`<option value="${m}">`).join('');
  const catSelect = document.getElementById('ex-category');
  if (catSelect) catSelect.innerHTML = CATALOG_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  document.getElementById('ex-name').value      = cat.name;
  document.getElementById('ex-muscle').value    = cat.muscle;
  document.getElementById('ex-icon').value      = cat.icon || '';
  document.getElementById('ex-sets').value      = cat.sets || '';
  document.getElementById('ex-color').value     = cat.color || '#c8f060';
  document.getElementById('ex-tip').value       = cat.tip || '';
  if (catSelect) catSelect.value = cat.category || 'Academia';
  const eqInput = document.getElementById('ex-equipment');
  if (eqInput) eqInput.value = cat.equipment || '';
  document.getElementById('overlay-ex').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('ex-name').focus(), 80);
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXERCISE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function openExModal(id) {
  exEditId=id;
  document.getElementById('ex-modal-title').textContent=id?'Editar Exercício':'Novo Exercício';
  const muscles=[...new Set(library.map(e=>e.muscle))];
  document.getElementById('muscle-list').innerHTML=muscles.map(m=>`<option value="${m}">`).join('');
  const catSelect = document.getElementById('ex-category');
  if (catSelect) catSelect.innerHTML = CATALOG_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(id){
    const ex=library.find(e=>e.id===id);
    if(ex){
      document.getElementById('ex-name').value  =ex.name;
      document.getElementById('ex-muscle').value=ex.muscle;
      document.getElementById('ex-icon').value  =ex.icon||'';
      document.getElementById('ex-sets').value  =ex.sets||'';
      document.getElementById('ex-color').value =ex.color||'#c8f060';
      document.getElementById('ex-tip').value   =ex.tip||'';
      if (catSelect) catSelect.value = ex.category || 'Academia';
      const eqInput = document.getElementById('ex-equipment');
      if (eqInput) eqInput.value = ex.equipment || '';
    }
  } else {
    ['ex-name','ex-muscle','ex-icon','ex-sets','ex-tip','ex-equipment'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('ex-color').value='#c8f060';
    if (catSelect) catSelect.value = 'Academia';
  }
  document.getElementById('overlay-ex').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('ex-name').focus(),80);
}
function closeExModal(){
  document.getElementById('overlay-ex').classList.remove('open');
  document.body.style.overflow='';
  catalogEditId = null;
}
function saveExercise(){
  const name  =document.getElementById('ex-name').value.trim();
  const muscle=document.getElementById('ex-muscle').value.trim();
  if(!name||!muscle){
    ['ex-name','ex-muscle'].forEach(id=>{
      const el=document.getElementById(id);
      if(!el.value.trim()){el.style.borderColor='var(--red)';el.focus();}
      setTimeout(()=>el.style.borderColor='',1500);
    });
    return;
  }
  const ex={
    id:    exEditId||Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    name, muscle,
    icon:  document.getElementById('ex-icon').value.trim()||'💪',
    sets:  document.getElementById('ex-sets').value.trim()||'',
    color: document.getElementById('ex-color').value||'#c8f060',
    tip:   document.getElementById('ex-tip').value.trim()||'',
    category: document.getElementById('ex-category')?.value || 'Academia',
    equipment: document.getElementById('ex-equipment')?.value.trim() || '',
    _userImported: true,
  };
  if(exEditId){const i=library.findIndex(e=>e.id===exEditId);if(i!==-1){ex.catalogId=library[i].catalogId; ex._userImported=library[i]._userImported; library[i]=ex;}}
  else {
    if (catalogEditId) { ex.catalogId = catalogEditId; ex._userImported = true; }
    library.push(ex);
  }
  save(K_LIB,library);
  catalogEditId = null;
  closeExModal();
  renderLibrary(); renderStats(); renderDayContent(); renderChecklist();
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIMER (descanso)
   ═══════════════════════════════════════════════════════════════════════════ */
function renderTimerPresets(){
  document.getElementById('preset-row').innerHTML=PRESETS.map(s=>`
    <div class="preset-btn ${tTotal===s&&tRemain===s?'active':''}" onclick="setPreset(${s})">
      ${s<60?s+'s':s===60?'1min':s===90?'1m30':'2min'}
    </div>`).join('');
}
function setPreset(s){
  clearInterval(tInterval);tTotal=s;tRemain=s;tRunning=false;
  document.getElementById('start-btn').textContent='Iniciar';
  document.getElementById('timer-status').textContent='PRONTO';
  updateTimerUI();renderTimerPresets();
}
function toggleTimer(){
  if(tRunning){
    clearInterval(tInterval);tRunning=false;
    document.getElementById('start-btn').textContent='Retomar';
    document.getElementById('timer-status').textContent='PAUSADO';
  } else {
    if(tRemain<=0) tRemain=tTotal;
    tRunning=true;
    document.getElementById('start-btn').textContent='Pausar';
    document.getElementById('timer-status').textContent='CONTANDO';
    tInterval=setInterval(()=>{
      tRemain--;updateTimerUI();
      if(tRemain<=0){
        clearInterval(tInterval);tRunning=false;
        document.getElementById('start-btn').textContent='Iniciar';
        document.getElementById('timer-status').textContent='PRONTO!';
        document.getElementById('ring').style.stroke='var(--red)';
        setTimeout(()=>document.getElementById('ring').style.stroke='var(--accent)',1400);
      }
    },1000);
  }
}
function resetTimer(){
  clearInterval(tInterval);tRunning=false;tRemain=tTotal;
  document.getElementById('start-btn').textContent='Iniciar';
  document.getElementById('timer-status').textContent='PRONTO';
  updateTimerUI();
}
function addTimerMinute(){tTotal+=60;tRemain+=60;updateTimerUI();}
function updateTimerUI(){
  const m=Math.floor(tRemain/60),s=tRemain%60;
  document.getElementById('timer-display').textContent=
    String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const pct=tTotal>0?tRemain/tTotal:1;
  document.getElementById('ring').setAttribute('stroke-dashoffset',534*(1-pct));
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ═══════════════════════════════════════════════════════════════════════════ */
let confirmCallback=null;
function showConfirm(title,msg,cb){
  confirmCallback=cb;
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').innerHTML=msg;
  document.getElementById('confirm-ok').onclick=()=>{cb();closeConfirm();};
  document.getElementById('overlay-confirm').classList.add('open');
}
function closeConfirm(){
  document.getElementById('overlay-confirm').classList.remove('open');
  confirmCallback=null;
}
