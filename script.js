/* -----------------------------------------------------------
   CONFIGURAÇÕES INICIAIS (Cloudinary, Firebase e PDF.js)
   ----------------------------------------------------------- */
const CLOUD_NAME = "dgagemtqg";
const UPLOAD_PRESET = "Gerenciador_Estudos";

const firebaseConfig = {
    apiKey: "AIzaSyDtziafcFDXZd9sGndXleqijouEIcqBeIk",
    authDomain: "gerenciador-de-estudos-9544b.firebaseapp.com",
    databaseURL: "https://gerenciador-de-estudos-9544b-default-rtdb.firebaseio.com/",
    projectId: "gerenciador-de-estudos-9544b",
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Configura o worker do PDF.js para renderização em segundo plano
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

/* -----------------------------------------------------------
   ESTADO GLOBAL DA APLICAÇÃO
   ----------------------------------------------------------- */
let studyData = {
    folders: [],
    settings: { alarmInterval: 86400000, alarmActive: true },
};
let currentDay = new Date().getDay(); // Dia atual (0-6)
let mode = "daily";                   // Modos: 'daily' ou 'all'
let activeFolderId = null;            // ID da matéria aberta
let activeFile = null;                // Arquivo PDF em leitura
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* -----------------------------------------------------------
   SINCRONIZAÇÃO COM BANCO DE DADOS (Realtime Database)
   ----------------------------------------------------------- */
// Escuta mudanças no banco e atualiza a interface automaticamente
db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        studyData = data;
        // Garante que as configurações existam
        if (!studyData.settings)
            studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        
        // Sincroniza os inputs do painel de controle
        document.getElementById("alarmInterval").value = studyData.settings.alarmInterval;
        document.getElementById("alarmActive").checked = studyData.settings.alarmActive;
    }
    render();
});

/* -----------------------------------------------------------
   FUNÇÕES DE NAVEGAÇÃO E CONFIGURAÇÃO
   ----------------------------------------------------------- */

// Atualiza intervalo de revisão e estado do alarme
function updateAlarmSettings() {
    studyData.settings.alarmInterval = parseInt(document.getElementById("alarmInterval").value);
    studyData.settings.alarmActive = document.getElementById("alarmActive").checked;
    db.ref("studyData").set(studyData);
}

// Muda o dia visualizado no cronograma
function setDay(d) {
    currentDay = d;
    mode = "daily";
    activeFolderId = null;
    render();
}

// Mostra todas as matérias cadastradas
function viewAll() {
    mode = "all";
    activeFolderId = null;
    render();
}

// Define manualmente quais dias uma matéria deve aparecer
function manualSchedule(folderId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    const input = prompt(`Dias (0-6):`, folder.days.join(","));
    if (input !== null) {
        folder.days = input
            .split(",")
            .map((n) => parseInt(n.trim()))
            .filter((n) => !isNaN(n));
        db.ref("studyData").set(studyData);
    }
}

// Distribui as matérias automaticamente pela semana
function autoDistribute() {
    if (studyData.folders.length === 0) return alert("Adicione matérias!");
    studyData.folders.forEach((folder, index) => {
        folder.days = [index % 7];
    });
    db.ref("studyData").set(studyData);
}

/* -----------------------------------------------------------
   UPLOAD DE ARQUIVOS (Cloudinary + Firebase)
   ----------------------------------------------------------- */
async function handleUpload() {
    const fileInput = document.getElementById("fileInput");
    const files = fileInput.files;
    if (files.length === 0) return;
    const folderName = prompt("Nome da Matéria:");
    if (!folderName) return;

    document.getElementById("uploadPanel").style.display = "block";
    const list = document.getElementById("uploadList");
    list.innerHTML = "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const item = document.createElement("div");
        item.className = "upload-item";
        item.id = "up-" + i;
        item.innerHTML = `<span>📄 ${file.name.substring(0,12)}...</span><div class="spinner"></div>`;
        list.appendChild(item);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            
            // Upload para o Cloudinary
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { 
                method: "POST", body: formData 
            });
            const data = await resp.json();

            if (data.secure_url) {
                let folder = studyData.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (!folder) {
                    folder = { id: "f" + Date.now(), name: folderName, files: [], days: [currentDay] };
                    studyData.folders.push(folder);
                }
                
                // Adiciona metadados do arquivo
                folder.files.push({
                    id: "d" + Date.now(),
                    name: file.name,
                    url: data.secure_url.replace("http://", "https://"),
                    progress: 0,
                    lastScroll: 0,
                    lastRead: null
                });
                
                await db.ref("studyData").set(studyData);
                document.getElementById("up-" + i).innerHTML = `<span>✅ Pronto</span>`;
            }
        } catch (e) {
            document.getElementById("up-" + i).innerHTML = `<span>❌ Erro</span>`;
        }
    }
    document.getElementById("uploadStatusTitle").innerText = "Concluído!";
    fileInput.value = "";
}

/* -----------------------------------------------------------
   VISUALIZADOR DE PDF E CONTROLE DE PROGRESSO
   ----------------------------------------------------------- */
async function openPDF(folderId, fileId) {
    const folder = studyData.folders.find((f) => f.id === folderId);
    activeFile = folder.files.find((f) => f.id === fileId);
    activeFolderId = folderId;
    
    // Registra o momento da leitura para o sistema de revisão
    activeFile.lastRead = Date.now();
    db.ref("studyData").set(studyData);

    document.getElementById("viewer").style.display = "flex";
    const content = document.getElementById("viewerContent");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const pdf = await pdfjsLib.getDocument(activeFile.url).promise;
        content.innerHTML = "";

        // Renderiza cada página do PDF em um elemento Canvas
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.3 });
            const canvas = document.createElement("canvas");
            content.appendChild(canvas);
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
        }

        // Monitora a rolagem para salvar o progresso
        content.onscroll = () => {
            const totalH = content.scrollHeight - content.clientHeight;
            if (totalH <= 0) return;
            const perc = Math.round((content.scrollTop / totalH) * 100);
            document.getElementById("scrollPerc").innerText = perc + "%";
            
            activeFile.progress = perc;
            activeFile.lastScroll = content.scrollTop;

            // Salva no banco em "checkpoints" de 10% para garantir persistência no deploy
            if (perc % 10 === 0) {
                db.ref("studyData").update(studyData);
            }
        };

        // Retorna o usuário para onde ele parou
        setTimeout(() => {
            content.scrollTop = activeFile.lastScroll || 0;
        }, 500);

    } catch (e) {
        console.error(e);
        alert("Erro ao abrir!");
    }
}

// Fecha o visualizador garantindo o salvamento final (Async para aguardar o Firebase)
async function closeAndSave() {
    try {
        await db.ref("studyData").set(studyData);
        document.getElementById("viewer").style.display = "none";
        render(); 
    } catch (e) {
        console.error("Erro ao salvar no fechamento:", e);
        document.getElementById("viewer").style.display = "none";
    }
}

/* -----------------------------------------------------------
   RENDERIZAÇÃO DA INTERFACE (HTML DINÂMICO)
   ----------------------------------------------------------- */
function render() {
    const now = Date.now();
    const config = studyData.settings || { alarmInterval: 86400000, alarmActive: true };

    // 1. Renderiza o Dashboard superior
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = studyData.folders.map((f) => {
        const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
        const needsRevision = config.alarmActive && f.files.some(file => file.lastRead && now - file.lastRead > config.alarmInterval);

        return `
            <div class="dash-card">
                ${needsRevision ? '<div class="revisao-badge">REVISAR</div>' : ""}
                <h4>📂 ${f.name}</h4>
                <div class="dash-perc">${avg}%</div>
                <div style="font-size:0.7em; color:#888;">Progresso</div>
            </div>`;
    }).join("");

    // 2. Atualiza os botões de dias da semana
    for (let i = 0; i <= 6; i++) {
        const btn = document.getElementById(`btn-day-${i}`);
        if (btn) {
            const hasContent = studyData.folders.some(f => f.days && f.days.includes(i));
            btn.classList.toggle("has-content", hasContent);
            btn.classList.toggle("active", i === currentDay && mode === "daily");
        }
    }

    // 3. Renderiza o Grid de matérias ou arquivos
    const grid = document.getElementById("grid");
    
    // VISÃO DE ARQUIVOS (Dentro de uma pasta)
    if (activeFolderId) {
        const folder = studyData.folders.find((f) => f.id === activeFolderId);
        document.getElementById("dayTitle").innerText = "📂 " + folder.name;
        grid.innerHTML = `<button onclick="activeFolderId=null; render()" class="btn btn-outline" style="grid-column:1/-1">⬅ Voltar</button>` +
            folder.files.map((file) => {
                const isLate = config.alarmActive && file.lastRead && now - file.lastRead > config.alarmInterval;
                return `
                <div class="card" onclick="openPDF('${folder.id}', '${file.id}')">
                    ${isLate ? '<div class="revisao-badge">REVISÃO</div>' : ""}
                    <button class="btn-del" onclick="deleteFile(event, '${folder.id}', '${file.id}')">×</button>
                    <h4>📄 ${file.name}</h4>
                    <div class="prog-container"><div class="prog-bar" style="width:${file.progress}%"></div></div>
                    <small>Visto: ${file.progress}%</small>
                </div>`;
            }).join("");
    } 
    // VISÃO DE PASTAS (Cronograma ou Todas)
    else {
        let filtered = mode === "all" ? studyData.folders : studyData.folders.filter(f => f.days && f.days.includes(currentDay));
        document.getElementById("dayTitle").innerText = mode === "all" ? "Todas as Pastas" : "Cronograma de " + dayNames[currentDay];
        
        grid.innerHTML = filtered.map((f) => {
            const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
            const needsRevision = config.alarmActive && f.files.some(file => file.lastRead && now - file.lastRead > config.alarmInterval);
            const badges = (f.days || []).map(d => `<span class="day-tag">${dayNames[d]}</span>`).join("");
            
            return `
                <div class="card" onclick="activeFolderId='${f.id}'; render()">
                    ${needsRevision ? '<div class="revisao-badge">REVISAR</div>' : ""}
                    <button class="btn-del" onclick="deleteFolder(event, '${f.id}')">×</button>
                    <h3 style="margin-top:5px">📂 ${f.name}</h3>
                    <div style="margin-bottom:10px">${badges}</div>
                    <div class="prog-container"><div class="prog-bar" style="width:${avg}%"></div></div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px">
                        <small>${f.files.length} PDFs • <b>Média ${avg}%</b></small>
                        <button class="btn-outline" style="font-size:0.75em; padding:3px 6px" onclick="event.stopPropagation(); manualSchedule('${f.id}')">⚙️ Dias</button>
                    </div>
                </div>`;
        }).join("");
    }
}

/* -----------------------------------------------------------
   FUNÇÕES DE EXCLUSÃO
   ----------------------------------------------------------- */
function deleteFolder(e, id) {
    e.stopPropagation();
    if (confirm("Deseja realmente excluir esta matéria?")) {
        studyData.folders = studyData.folders.filter((f) => f.id !== id);
        db.ref("studyData").set(studyData);
    }
}

function deleteFile(e, fid, id) {
    e.stopPropagation();
    const folder = studyData.folders.find((f) => f.id === fid);
    folder.files = folder.files.filter((f) => f.id !== id);
    db.ref("studyData").set(studyData);
}

// Inicializa a interface ao carregar a página
window.onload = () => render();
