// Configurações
const CLOUD_NAME = "dgagemtqg";
const UPLOAD_PRESET = "Gerenciador_Estudos";
const firebaseConfig = {
    apiKey: "AIzaSyDtziafcFDXZd9sGndXleqijouEIcqBeIk",
    authDomain: "gerenciador-de-estudos-9544b.firebaseapp.com",
    databaseURL: "https://gerenciador-de-estudos-9544b-default-rtdb.firebaseio.com",
    projectId: "gerenciador-de-estudos-9544b",
};

// Inicialização
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

let studyData = { folders: [], settings: { alarmInterval: 86400000, alarmActive: true } };
let currentDay = new Date().getDay();
let mode = "daily";
let activeFolderId = null;
let activeFile = null;
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Carregamento Inicial
db.ref("studyData").on("value", (snap) => {
    const data = snap.val();
    if (data) {
        studyData = data;
        if (!studyData.settings) studyData.settings = { alarmInterval: 86400000, alarmActive: true };
        document.getElementById("alarmInterval").value = studyData.settings.alarmInterval;
        document.getElementById("alarmActive").checked = studyData.settings.alarmActive;
        render();
    }
});

// Função centralizada para salvar no Firebase (Evita perdas no Deploy)
async function updateFirebase() {
    try {
        await db.ref("studyData").set(studyData);
    } catch (e) {
        console.error("Erro ao sincronizar Firebase:", e);
    }
}

function updateAlarmSettings() {
    studyData.settings.alarmInterval = parseInt(document.getElementById("alarmInterval").value);
    studyData.settings.alarmActive = document.getElementById("alarmActive").checked;
    updateFirebase();
}

function setDay(d) {
    currentDay = d; mode = "daily"; activeFolderId = null; render();
}

function viewAll() {
    mode = "all"; activeFolderId = null; render();
}

function manualSchedule(folderId) {
    const folder = studyData.folders.find(f => f.id === folderId);
    const input = prompt(`Dias (0-6):`, folder.days.join(","));
    if (input !== null) {
        folder.days = input.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        updateFirebase();
    }
}

function autoDistribute() {
    if (studyData.folders.length === 0) return alert("Adicione matérias!");
    studyData.folders.forEach((f, i) => f.days = [i % 7]);
    updateFirebase();
}

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
        item.innerHTML = `<span>📄 ${file.name.substring(0,10)}...</span><div class="spinner"></div>`;
        list.appendChild(item);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);
            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, { method: "POST", body: formData });
            const data = await resp.json();

            if (data.secure_url) {
                let folder = studyData.folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (!folder) {
                    folder = { id: "f" + Date.now(), name: folderName, files: [], days: [currentDay] };
                    studyData.folders.push(folder);
                }
                folder.files.push({
                    id: "d" + Date.now(),
                    name: file.name,
                    url: data.secure_url.replace("http://", "https://"),
                    progress: 0, lastScroll: 0, lastRead: null
                });
                await updateFirebase();
                document.getElementById("up-" + i).innerHTML = `<span>✅ Pronto</span>`;
            }
        } catch (e) {
            document.getElementById("up-" + i).innerHTML = `<span>❌ Erro</span>`;
        }
    }
    document.getElementById("uploadStatusTitle").innerText = "Concluído!";
    fileInput.value = "";
}

async function openPDF(folderId, fileId) {
    const folder = studyData.folders.find(f => f.id === folderId);
    activeFile = folder.files.find(f => f.id === fileId);
    activeFolderId = folderId;
    activeFile.lastRead = Date.now();
    updateFirebase();

    document.getElementById("viewer").style.display = "flex";
    const content = document.getElementById("viewerContent");
    content.innerHTML = "<h2>Carregando PDF...</h2>";

    try {
        const pdf = await pdfjsLib.getDocument(activeFile.url).promise;
        content.innerHTML = "";
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

        content.onscroll = () => {
            const totalH = content.scrollHeight - content.clientHeight;
            const perc = Math.round((content.scrollTop / totalH) * 100);
            document.getElementById("scrollPerc").innerText = perc + "%";
            activeFile.progress = perc;
            activeFile.lastScroll = content.scrollTop;
            
            // Salva no Firebase a cada 10% de rolagem (Garante o progresso no deploy)
            if (perc % 10 === 0) updateFirebase();
        };

        setTimeout(() => { content.scrollTop = activeFile.lastScroll || 0; }, 500);
    } catch (e) { alert("Erro ao abrir PDF!"); }
}

async function closeAndSave() {
    await updateFirebase();
    document.getElementById("viewer").style.display = "none";
    render();
}

function render() {
    const now = Date.now();
    const config = studyData.settings;
    
    // Render Dashboard
    const dashboard = document.getElementById("dashboard");
    dashboard.innerHTML = studyData.folders.map(f => {
        const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
        const needsRev = config.alarmActive && f.files.some(file => file.lastRead && now - file.lastRead > config.alarmInterval);
        return `<div class="dash-card">
            ${needsRev ? '<div class="revisao-badge">REVISAR</div>' : ''}
            <h4>${f.name}</h4>
            <div class="dash-perc">${avg}%</div>
        </div>`;
    }).join("");

    // Update Day Buttons
    for (let i = 0; i <= 6; i++) {
        const btn = document.getElementById(`btn-day-${i}`);
        if (btn) {
            btn.classList.toggle("active", i === currentDay && mode === "daily");
            btn.classList.toggle("has-content", studyData.folders.some(f => f.days?.includes(i)));
        }
    }

    // Render Grid
    const grid = document.getElementById("grid");
    if (activeFolderId) {
        const folder = studyData.folders.find(f => f.id === activeFolderId);
        document.getElementById("dayTitle").innerText = "📂 " + folder.name;
        grid.innerHTML = `<button onclick="activeFolderId=null; render()" class="btn-back">⬅ Voltar</button>` +
            folder.files.map(file => {
                const late = config.alarmActive && file.lastRead && now - file.lastRead > config.alarmInterval;
                return `<div class="card" onclick="openPDF('${folder.id}', '${file.id}')">
                    ${late ? '<div class="revisao-badge">REVISÃO</div>' : ''}
                    <button class="btn-del" onclick="deleteFile(event, '${folder.id}', '${file.id}')">×</button>
                    <h4>${file.name}</h4>
                    <div class="prog-container"><div class="prog-bar" style="width:${file.progress}%"></div></div>
                    <small>${file.progress}% concluído</small>
                </div>`;
            }).join("");
    } else {
        let filtered = mode === "all" ? studyData.folders : studyData.folders.filter(f => f.days?.includes(currentDay));
        document.getElementById("dayTitle").innerText = mode === "all" ? "Todas as Pastas" : "Cronograma de " + dayNames[currentDay];
        grid.innerHTML = filtered.map(f => {
            const avg = f.files.length ? Math.round(f.files.reduce((a, b) => a + (b.progress || 0), 0) / f.files.length) : 0;
            return `<div class="card" onclick="activeFolderId='${f.id}'; render()">
                <button class="btn-del" onclick="deleteFolder(event, '${f.id}')">×</button>
                <h3>📂 ${f.name}</h3>
                <div class="prog-container"><div class="prog-bar" style="width:${avg}%"></div></div>
                <div class="card-footer">
                    <small>${f.files.length} PDFs • ${avg}%</small>
                    <button class="btn-setup" onclick="event.stopPropagation(); manualSchedule('${f.id}')">⚙️ Dias</button>
                </div>
            </div>`;
        }).join("");
    }
}

function deleteFolder(e, id) {
    e.stopPropagation();
    if (confirm("Excluir Matéria?")) {
        studyData.folders = studyData.folders.filter(f => f.id !== id);
        updateFirebase();
    }
}

function deleteFile(e, fid, id) {
    e.stopPropagation();
    const folder = studyData.folders.find(f => f.id === fid);
    folder.files = folder.files.filter(f => f.id !== id);
    updateFirebase();
}

window.onload = () => render();
